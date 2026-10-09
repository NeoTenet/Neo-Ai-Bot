/**
 * Telegram AI Bot - Cloudflare Worker + Upstash Redis (100% Safe & Stable)
 * Developer Channel: T.me/Neotenet
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      try {
        const update = await request.json();
        // اجرای پردازش اصلی در پس‌زمینه بدون معطل کردن تلگرام
        ctx.waitUntil(handleUpdate(update, env, ctx));
      } catch (err) {
        console.error("Update Error:", err);
      }
      // پاسخ فوری زیر ۵ میلی‌ثانیه به تلگرام برای جلوگیری از تایم‌آوت
      return new Response("OK", { status: 200 });
    }
    return new Response("Bot is active with Upstash Redis!", { status: 200 });
  }
};

// ==========================================
// ۰. توابع کمکی اتصال به دیتابیس Upstash Redis
// ==========================================
async function upstashCommand(env, cmd) {
  try {
    const res = await fetch(env.UPSTASH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.UPSTASH_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(cmd)
    });
    const data = await res.json();
    return data.result;
  } catch (e) {
    console.error("Upstash Redis Error:", e);
    return null;
  }
}

async function safeKvPut(env, key, value, options = {}) {
  try {
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    if (options.expirationTtl) {
      await upstashCommand(env, ["SET", key, strVal, "EX", options.expirationTtl]);
    } else {
      await upstashCommand(env, ["SET", key, strVal]);
    }
    return true;
  } catch (e) {
    console.error(`Upstash Set Error [${key}]:`, e);
    return false;
  }
}

async function safeKvGet(env, key) {
  try {
    const res = await upstashCommand(env, ["GET", key]);
    return res !== undefined && res !== null ? String(res) : null;
  } catch (e) {
    console.error(`Upstash Get Error [${key}]:`, e);
    return null;
  }
}

async function safeKvDelete(env, key) {
  try {
    await upstashCommand(env, ["DEL", key]);
    return true;
  } catch (e) {
    console.error(`Upstash Del Error [${key}]:`, e);
    return false;
  }
}

// ==========================================
// ۱. هندلر اصلی پردازش آپدیت‌های تلگرام
// ==========================================
async function handleUpdate(update, env, ctx) {
  const botToken = env.BOT_TOKEN;
  const adminId = String(env.ADMIN_ID || "");

  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;

    if (!msg.from) return;

    const userId = String(msg.from.id);
    let text = msg.text || msg.caption || "";
    const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";

    // ثبت آمار فعالیت کاربر
    ctx.waitUntil(trackUserActivity(env, userId));

    if (msg.document) {
      const doc = msg.document;
      if (doc.file_name && (doc.file_name.endsWith('.js') || doc.file_name.endsWith('.py') || doc.file_name.endsWith('.txt') || doc.file_name.endsWith('.json') || doc.file_name.endsWith('.html') || doc.file_name.endsWith('.css') || doc.file_name.endsWith('.cpp') || doc.file_name.endsWith('.java'))) {
        const fileContent = await getTelegramFileText(botToken, doc.file_id);
        if (fileContent) {
          text = `${text}\n\n محتوای فایل ارسال شده (${doc.file_name}):\n\`\`\`\n${fileContent}\n\`\`\``;
        }
      }
    }

    const isBanned = await safeKvGet(env, `BANNED_${userId}`);
    if (isBanned === "true") {
      await tgRequest(botToken, "sendMessage", {
        chat_id: chatId,
        text: "⛔ حساب شما توسط مدیریت مسدود شده است."
      });
      return;
    }

    if (!isGroup) {
      const sponsorCheck = await checkSponsorJoin(botToken, env, userId);
      if (!sponsorCheck.ok && adminId && userId !== adminId) {
        const keyboard = sponsorCheck.unjoined.map(ch => [
          { text: `📢 ورود به کانال ${ch}`, url: `https://t.me/${ch.replace("@", "")}` }
        ]);
        keyboard.push([{ text: "✅ عضو شدم / بررسی", callback_data: "check_sponsor" }]);

        await tgRequest(botToken, "sendMessage", {
          chat_id: chatId,
          text: "⚠️ برای استفاده از ربات ابتدا باید در کانال(های) اسپانسر زیر عضو شوید:",
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }
    }

    const adminStep = await safeKvGet(env, `ADMIN_STEP_${userId}`);
    if (adminStep && userId === adminId) {
      await handleAdminSteps(botToken, env, chatId, userId, text, adminStep);
      return;
    }

    if (text.startsWith("/start")) {
      await clearUserState(env, userId);
      await sendMainMenu(botToken, chatId, userId, adminId);
      return;
    }

    if (text.startsWith("/models")) {
      if (adminId && userId !== adminId) {
        await tgRequest(botToken, "sendMessage", {
          chat_id: chatId,
          text: "⛔ این دستور تنها برای ادمین ربات مجاز است."
        });
        return;
      }
      await sendModelSelectionMenu(botToken, env, chatId, isGroup ? `group_${chatId}` : userId);
      return;
    }

    if (isGroup) {
      const botInfo = await tgRequest(botToken, "getMe", {});
      const botUsername = botInfo.result?.username ? `@${botInfo.result.username.toLowerCase()}` : "";
      const isReplyToBot = msg.reply_to_message && String(msg.reply_to_message.from?.id) === String(botInfo.result?.id);
      const isMentioned = botUsername && text.toLowerCase().includes(botUsername);

      if (!isReplyToBot && !isMentioned) return;
      if (isMentioned && botUsername) {
        text = text.replace(new RegExp(botUsername, 'gi'), "").trim();
      }
    }

    const targetKeyId = isGroup ? `group_${chatId}` : userId;
    const userMode = (await safeKvGet(env, `USER_MODE_${targetKeyId}`)) || "CHAT";

    if (userMode === "IMAGE_GEN") {
      await processImageRequest(botToken, env, chatId, userId, text, targetKeyId);
    } else {
      await processAIRequest(botToken, env, chatId, userId, msg, text, targetKeyId, isGroup);
    }

  } else if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message.chat.id;
    const userId = String(query.from.id);
    const data = query.data;
    const isGroupQuery = query.message.chat.type === "group" || query.message.chat.type === "supergroup";
    const targetKeyId = isGroupQuery ? `group_${chatId}` : userId;
    const adminId = String(env.ADMIN_ID || "");

    // بررسی لغو درخواست
    if (data.startsWith("cancel_req_")) {
      const reqId = data.replace("cancel_req_", "");
      const ownerUserId = reqId.split("_")[0];

      if (userId !== ownerUserId) {
        await tgRequest(botToken, "answerCallbackQuery", {
          callback_query_id: query.id,
          text: "⛔ این درخواست متعلق به شما نیست!",
          show_alert: true
        });
        return;
      }

      await tgRequest(botToken, "answerCallbackQuery", {
        callback_query_id: query.id,
        text: "✅ درخواست لغو شد."
      });

      await safeKvPut(env, `CANCEL_${reqId}`, "true", { expirationTtl: 300 });

      await tgRequest(botToken, "editMessageText", {
        chat_id: chatId,
        message_id: query.message.message_id,
        text: "❌ درخواست توسط کاربر لغو شد."
      });
      return;
    }

    await tgRequest(botToken, "answerCallbackQuery", { callback_query_id: query.id });

    if (data === "check_sponsor" || data === "main_menu" || data === "mode_chat" || data === "mode_image" || data === "select_model_menu" || data === "history_menu" || data === "new_chat") {
      await clearUserState(env, userId);
    }

    if (data === "check_sponsor" || data === "main_menu") {
      if (!isGroupQuery) {
        await sendMainMenu(botToken, chatId, userId, adminId);
      }
    } else if (data === "mode_chat") {
      await safeKvPut(env, `USER_MODE_${targetKeyId}`, "CHAT");
      await tgRequest(botToken, "sendMessage", {
        chat_id: chatId,
        text: "💬 حالت گفتگو متنی، تصویری، فایل و ساخت کد فعال شد. پیام، عکس یا فایل کد خود را بفرستید."
      });
    } else if (data === "mode_image") {
      await safeKvPut(env, `USER_MODE_${targetKeyId}`, "IMAGE_GEN");
      if (!isGroupQuery) await sendImageModelSelectionMenu(botToken, env, chatId, userId);
    } else if (data === "select_model_menu") {
      await sendModelSelectionMenu(botToken, env, chatId, targetKeyId);
    } else if (data.startsWith("set_model_")) {
      const modelIndex = data.replace("set_model_", "");
      await safeKvPut(env, `USER_MODEL_${targetKeyId}`, modelIndex);
      
      const activeSessId = await safeKvGet(env, `ACTIVE_SESSION_${userId}`);
      if (activeSessId) {
        let sessions = JSON.parse((await safeKvGet(env, `SESSIONS_${userId}`)) || "[]");
        const sess = sessions.find(s => s.id === activeSessId);
        if (sess) {
          sess.modelIndex = modelIndex;
          await safeKvPut(env, `SESSIONS_${userId}`, JSON.stringify(sessions));
        }
      }

      const models = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
      const selectedModelName = models[modelIndex]?.name || "انتخاب شده";
      await tgRequest(botToken, "sendMessage", {
        chat_id: chatId,
        text: `✅ مدل فعال چت روی **${selectedModelName}** تنظیم شد.`
      });
    } else if (data.startsWith("set_img_model_")) {
      const imgIdx = data.replace("set_img_model_", "");
      await safeKvPut(env, `USER_IMG_MODEL_${targetKeyId}`, imgIdx);
      const imgModels = JSON.parse((await safeKvGet(env, "IMAGE_MODELS")) || "[]");
      const selectedImgName = imgModels[imgIdx]?.name || "انتخاب شده";
      await tgRequest(botToken, "sendMessage", {
        chat_id: chatId,
        text: `🎨 مدل ساخت عکس روی **${selectedImgName}** تنظیم شد.`
      });
    } else if (data === "history_menu" && !isGroupQuery) {
      await sendHistoryMenu(botToken, env, chatId, userId);
    } else if (data === "new_chat" && !isGroupQuery) {
      const newSessId = `sess_${Date.now()}`;
      await safeKvPut(env, `ACTIVE_SESSION_${userId}`, newSessId);
      let sessions = JSON.parse((await safeKvGet(env, `SESSIONS_${userId}`)) || "[]");
      sessions.unshift({ id: newSessId, title: "گفتگوی جدید 💬", date: new Date().toLocaleDateString('fa-IR') });
      await safeKvPut(env, `SESSIONS_${userId}`, JSON.stringify(sessions));
      await tgRequest(botToken, "sendMessage", {
        chat_id: chatId,
        text: "✨ چت جدید ایجاد شد! پیام خود را بفرستید."
      });
    } else if (data.startsWith("switch_sess_") && !isGroupQuery) {
      const sessId = data.replace("switch_sess_", "");
      await safeKvPut(env, `ACTIVE_SESSION_${userId}`, sessId);
      await tgRequest(botToken, "sendMessage", {
        chat_id: chatId,
        text: "🔄 با موفقیت به این گفتگو منتقل شدید."
      });
    } else if (data === "admin_panel" && userId === adminId) {
      await clearUserState(env, userId);
      await sendAdminPanel(botToken, chatId);
    } else if (data === "admin_stats" && userId === adminId) {
      await sendBotStats(botToken, env, chatId);
    } else if (data === "admin_add_model" && userId === adminId) {
      await safeKvPut(env, `ADMIN_STEP_${userId}`, "ADD_MODEL_NAME");
      await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "📝 نام عمومی مدل چت را وارد کنید:" });
    } else if (data === "admin_add_img_model" && userId === adminId) {
      await safeKvPut(env, `ADMIN_STEP_${userId}`, "ADD_IMG_NAME");
      await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "🎨 نام عمومی مدل ساخت عکس را وارد کنید:" });
    } else if (data === "admin_list_models" && userId === adminId) {
      await sendAdminModelsList(botToken, env, chatId);
    } else if (data === "admin_edit_models_menu" && userId === adminId) {
      await sendAdminEditModelsList(botToken, env, chatId);
    } else if (data.startsWith("edit_model_") && userId === adminId) {
      const idx = data.replace("edit_model_", "");
      await safeKvPut(env, `ADMIN_EDIT_IDX_${userId}`, idx);
      await safeKvPut(env, `ADMIN_STEP_${userId}`, "EDIT_MODEL_NAME");
      await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "✏️ نام جدید مدل چت را وارد کنید (یا .):" });
    } else if (data.startsWith("edit_img_model_") && userId === adminId) {
      const idx = data.replace("edit_img_model_", "");
      await safeKvPut(env, `ADMIN_EDIT_IMG_IDX_${userId}`, idx);
      await safeKvPut(env, `ADMIN_STEP_${userId}`, "EDIT_IMG_NAME");
      await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "✏️ نام جدید مدل تصویر را وارد کنید (یا .):" });
    } else if (data.startsWith("del_model_") && userId === adminId) {
      const idx = parseInt(data.replace("del_model_", ""));
      let models = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
      if (idx >= 0 && idx < models.length) {
        models.splice(idx, 1);
        await safeKvPut(env, "AI_MODELS", JSON.stringify(models));
      }
      await sendAdminModelsList(botToken, env, chatId, query.message.message_id);
    } else if (data.startsWith("del_img_model_") && userId === adminId) {
      const idx = parseInt(data.replace("del_img_model_", ""));
      let imgModels = JSON.parse((await safeKvGet(env, "IMAGE_MODELS")) || "[]");
      if (idx >= 0 && idx < imgModels.length) {
        imgModels.splice(idx, 1);
        await safeKvPut(env, "IMAGE_MODELS", JSON.stringify(imgModels));
      }
      await sendAdminModelsList(botToken, env, chatId, query.message.message_id);
    } else if (data === "admin_add_sponsor" && userId === adminId) {
      await safeKvPut(env, `ADMIN_STEP_${userId}`, "ADD_SPONSOR");
      await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "📢 آیدی کانال اسپانسری را وارد کنید:" });
    } else if (data === "admin_del_sponsor_menu" && userId === adminId) {
      await sendAdminSponsorList(botToken, env, chatId);
    } else if (data.startsWith("del_sponsor_") && userId === adminId) {
      const idx = parseInt(data.replace("del_sponsor_", ""));
      let channels = JSON.parse((await safeKvGet(env, "SPONSOR_CHANNELS")) || "[]");
      channels.splice(idx, 1);
      await safeKvPut(env, "SPONSOR_CHANNELS", JSON.stringify(channels));
      await sendAdminSponsorList(botToken, env, chatId, query.message.message_id);
    } else if (data === "admin_ban_user" && userId === adminId) {
      await safeKvPut(env, `ADMIN_STEP_${userId}`, "BAN_USER");
      await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "🚫 آیدی عددی کاربر برای مسدودسازی:" });
    } else if (data === "admin_unban_user" && userId === adminId) {
      await safeKvPut(env, `ADMIN_STEP_${userId}`, "UNBAN_USER");
      await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "✅ آیدی عددی کاربر برای رفع مسدودی:" });
    }
  }
}

// ==========================================
// ۲. منوها و رابط کاربری
// ==========================================
async function sendMainMenu(botToken, chatId, userId, adminId) {
  const keyboard = [
    [
      { text: "💬 چت، فایل و ساخت کد", callback_data: "mode_chat" },
      { text: "🎨 ساخت عکس (Image Gen)", callback_data: "mode_image" }
    ],
    [{ text: "🤖 انتخاب مدل چت", callback_data: "select_model_menu" }],
    [{ text: "📜 تاریخچه چت‌ها و گفتگوها", callback_data: "history_menu" }],
    [{ text: "➕ شروع گفتگو جدید", callback_data: "new_chat" }]
  ];

  if (userId === adminId) {
    keyboard.push([{ text: "⚙️ پنل مدیریت ادمین", callback_data: "admin_panel" }]);
  }

  await tgRequest(botToken, "sendMessage", {
    chat_id: chatId,
    text: "🚀 **به ربات پیشرفته هوش مصنوعی خوش آمدید!**",
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendHistoryMenu(botToken, env, chatId, userId) {
  const sessions = JSON.parse((await safeKvGet(env, `SESSIONS_${userId}`)) || "[]");
  const activeSess = await safeKvGet(env, `ACTIVE_SESSION_${userId}`);

  if (sessions.length === 0) {
    await tgRequest(botToken, "sendMessage", {
      chat_id: chatId,
      text: "📜 هیچ تاریخچه گفتگویی یافت نشد."
    });
    return;
  }

  const keyboard = sessions.slice(0, 10).map((s) => {
    const isCurrent = s.id === activeSess ? "✅ " : "";
    return [{ text: `${isCurrent}${s.title}`, callback_data: `switch_sess_${s.id}` }];
  });

  keyboard.push([{ text: "➕ ایجاد چت جدید", callback_data: "new_chat" }]);
  keyboard.push([{ text: "🔙 منوی اصلی", callback_data: "main_menu" }]);

  await tgRequest(botToken, "sendMessage", {
    chat_id: chatId,
    text: "📜 **لیست گفتگوهای قبلی شما:**",
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendModelSelectionMenu(botToken, env, chatId, targetKeyId) {
  const models = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
  const currentModelIdx = (await safeKvGet(env, `USER_MODEL_${targetKeyId}`)) || "0";

  if (models.length === 0) {
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "⚠️ هیچ مدلی تعریف نشده است." });
    return;
  }

  const keyboard = models.map((m, index) => [{
    text: `${String(index) === String(currentModelIdx) ? "✅ " : ""}${m.name} ${m.supportsVision ? "👁️" : ""}`,
    callback_data: `set_model_${index}`
  }]);
  
  keyboard.push([{ text: "🔙 منوی اصلی", callback_data: "main_menu" }]);

  await tgRequest(botToken, "sendMessage", {
    chat_id: chatId,
    text: "✨ **مدل هوش مصنوعی چت را انتخاب کنید:**",
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendImageModelSelectionMenu(botToken, env, chatId, userId) {
  const imgModels = JSON.parse((await safeKvGet(env, "IMAGE_MODELS")) || "[]");
  const currentIdx = (await safeKvGet(env, `USER_IMG_MODEL_${userId}`)) || "0";

  if (imgModels.length === 0) {
    await tgRequest(botToken, "sendMessage", {
      chat_id: chatId,
      text: "⚠️ هیچ مدل تصویرسازی تعریف نشده است."
    });
    return;
  }

  const keyboard = imgModels.map((m, index) => [{
    text: `${String(index) === String(currentIdx) ? "✅ " : ""}${m.name}`,
    callback_data: `set_img_model_${index}`
  }]);
  keyboard.push([{ text: "🔙 منوی اصلی", callback_data: "main_menu" }]);

  await tgRequest(botToken, "sendMessage", {
    chat_id: chatId,
    text: "🎨 **مدل ساخت عکس را انتخاب کنید:**",
    reply_markup: { inline_keyboard: keyboard }
  });
}

function isCodeRequest(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const codeKeywords = [
    'code', 'script', 'bug', 'error', 'function', 'const', 'let', 'var', 
    'import', 'export', 'def', 'class', 'html', 'css', 'js', 'python', 
    'c++', 'java', 'sql', 'json', 'async', 'await', 'return', 'if', 'else',
    'کد', 'برنامه', 'اسکریپت', 'باگ', 'خطا', 'دیباگ', 'خط', 'توابع', 'متغیر', 'ارور', 'بساز', 'بنویس'
  ];
  return codeKeywords.some(keyword => lower.includes(keyword));
}

// ==========================================
// ۳. پردازش چت و ساخت کد با پایداری کامل
// ==========================================
async function processAIRequest(botToken, env, chatId, userId, msg, textPrompt, targetKeyId, isGroup) {
  const models = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
  const activeSessionId = await getOrCreateActiveSession(env, userId);

  let userSelectedModel = await safeKvGet(env, `USER_MODEL_${targetKeyId}`);
  if (userSelectedModel === null) {
    userSelectedModel = await safeKvGet(env, `USER_MODEL_${userId}`);
  }

  let modelIdx = parseInt(userSelectedModel || "0");
  if (isNaN(modelIdx) || !models[modelIdx]) modelIdx = 0;

  if (models.length === 0 || !models[modelIdx]) {
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "⚠️ ابتدا یک مدل چت اضافه کنید." });
    return;
  }

  const activeModel = models[modelIdx];
  if (!textPrompt) textPrompt = "لطفاً بررسی کن یا پاسخ بده.";
  const isCode = isCodeRequest(textPrompt);

  const reqId = `${userId}_${Date.now()}`;
  const cancelKeyboard = {
    inline_keyboard: [[{ text: "❌ لغو و توقف فکر کردن", callback_data: `cancel_req_${reqId}` }]]
  };

  const statusRes = await tgRequest(botToken, "sendMessage", {
    chat_id: chatId,
    text: isCode ? "💻 در حال نوشتن و ساخت کد... (۵ ثانیه)" : "🧠 در حال فکر کردن... (۵ ثانیه)",
    reply_parameters: isGroup ? { message_id: msg.message_id } : undefined,
    reply_markup: cancelKeyboard
  });

  const statusMsgId = statusRes.result?.message_id;
  if (!statusMsgId) return;

  let seconds = 5;
  let isDone = false;
  let apiResponseText = null;

  // بهینه‌سازی تایمر پردازش و جلوگیری از دریافت ارور 429 تلگرام
  const timerPromise = (async () => {
    while (!isDone && seconds < 90) {
      await sleep(5000);
      if (isDone) break;

      const isCancelled = await safeKvGet(env, `CANCEL_${reqId}`);
      if (isCancelled === "true") {
        isDone = true;
        break;
      }

      seconds += 5;
      // تمدید وضعیت typing
      await tgRequest(botToken, "sendChatAction", { chat_id: chatId, action: "typing" });

      const currentStatusText = isCode
        ? `💻 در حال نوشتن، ساخت و دیباگ کد... (${seconds} ثانیه)`
        : `🧠 در حال فکر کردن... (${seconds} ثانیه)`;
      try {
        await tgRequest(botToken, "editMessageText", {
          chat_id: chatId,
          message_id: statusMsgId,
          text: currentStatusText,
          reply_markup: cancelKeyboard
        });
      } catch (e) {}
    }
  })();

  try {
    let history = JSON.parse((await safeKvGet(env, `HISTORY_${userId}_${activeSessionId}`)) || "[]");
    let userContent;

    if (msg.photo && msg.photo.length > 0) {
      if (!activeModel.supportsVision) {
        isDone = true;
        await tgRequest(botToken, "editMessageText", {
          chat_id: chatId,
          message_id: statusMsgId,
          text: "❌ این مدل از تحلیل عکس پشتیبانی نمی‌کند."
        });
        return;
      }
      const photo = msg.photo[msg.photo.length - 1];
      const fileBase64 = await getTelegramFileBase64(botToken, photo.file_id);
      if (!fileBase64) {
        isDone = true;
        await tgRequest(botToken, "editMessageText", {
          chat_id: chatId,
          message_id: statusMsgId,
          text: "❌ خطا در دریافت تصویر از تلگرام."
        });
        return;
      }
      userContent = [
        { type: "text", text: textPrompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${fileBase64}` } }
      ];
    } else {
      userContent = textPrompt;
    }

    history.push({ role: "user", content: userContent });

    let cleanedMessages = history.map((item, idx) => {
      if (idx < history.length - 1 && Array.isArray(item.content)) {
        const textPart = item.content.find(p => p.type === "text")?.text || "تصویر قبلی";
        return { role: item.role, content: `[تصویر ارسال شده: ${textPart}]` };
      }
      return item;
    });

    while (cleanedMessages.length > 0 && cleanedMessages[0].role === "assistant") {
      cleanedMessages.shift();
    }

    if (cleanedMessages.length > 10) {
      cleanedMessages = cleanedMessages.slice(-10);
      if (cleanedMessages[0].role === "assistant") cleanedMessages.shift();
    }

    const baseUrl = activeModel.baseUrl.trim().replace(/\/+$/, "");
    const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;

    const systemPrompt = {
      role: "system",
      content: "تو یک مهندس ارشد نرم‌افزار و متخصص هوش مصنوعی هستی. پاسخ کاربر را کاملاً دقیق، تمیز، خلاصه و به همراه توضیحات لازم یا کد Markdown ارسال کن."
    };

    const payload = {
      model: activeModel.modelName,
      messages: [systemPrompt, ...cleanedMessages],
      max_tokens: 1500,
      stream: false
    };

    // افزایش زمان انتظار API از ۲۴ به ۵۵ ثانیه جهت جلوگیری از قطعی مصنوعی درخواست
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${activeModel.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const isCancelled = await safeKvGet(env, `CANCEL_${reqId}`);
    if (isCancelled === "true") {
      apiResponseText = null;
    } else if (res.ok) {
      const data = await res.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        apiResponseText = data.choices[0].message.content;
      }
    } else {
      const errDetail = await res.text();
      console.error("AI Error Status:", res.status, errDetail);
      apiResponseText = `❌ خطای پاسخ‌دهی از سمت سرویس API (کد خطا: ${res.status})`;
    }

    if (apiResponseText && !apiResponseText.startsWith("❌")) {
      history.push({ role: "assistant", content: apiResponseText });

      const historyToSave = history.slice(-12).map(item => {
        if (Array.isArray(item.content)) {
          const textPart = item.content.find(p => p.type === "text")?.text || "تصویر";
          return { role: item.role, content: textPart };
        }
        return item;
      });

      await safeKvPut(env, `HISTORY_${userId}_${activeSessionId}`, JSON.stringify(historyToSave));
      await updateSessionTitleIfNew(env, userId, activeSessionId, textPrompt);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      apiResponseText = "❌ زمان پاسخ‌دهی مدل به اتمام رسید. لطفاً مدل سریع‌تری را انتخاب کنید.";
    } else {
      console.error("Fetch Execution Error:", err);
      apiResponseText = "❌ خطا در برقراری ارتباط با سرور هوش مصنوعی.";
    }
  } finally {
    isDone = true;
    await safeKvDelete(env, `CANCEL_${reqId}`);
  }

  await timerPromise;

  if (apiResponseText && !apiResponseText.startsWith("❌")) {
    let finalOutput = apiResponseText;
    if (isGroup) {
      const userMention = msg.from?.username ? `@${msg.from.username}` : (msg.from?.first_name || "کاربر");
      finalOutput = `👤 کاربر: ${userMention}\n🤖 مدل: ${activeModel.name}\n-------------------\n\n${apiResponseText}`;
    }

    await sendSafeAIResponse(botToken, chatId, statusMsgId, finalOutput, isGroup ? msg.message_id : null);
  } else {
    const isCancelledFinal = await safeKvGet(env, `CANCEL_${reqId}`);
    if (!isCancelledFinal) {
      await tgRequest(botToken, "editMessageText", {
        chat_id: chatId,
        message_id: statusMsgId,
        text: apiResponseText || "❌ ارتباط با API برقرار نشد یا سرویس پاسخگو نبود."
      });
    }
  }
}

async function sendSafeAIResponse(botToken, chatId, messageId, text, replyToMessageId = null) {
  if (text.length <= 4000) {
    let res = await tgRequest(botToken, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "Markdown",
      reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined
    });
    if (!res.ok) {
      await tgRequest(botToken, "editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined
      });
    }
  } else {
    await tgRequest(botToken, "deleteMessage", { chat_id: chatId, message_id: messageId });
    const chunks = chunkString(text, 4000);
    for (const chunk of chunks) {
      let res = await tgRequest(botToken, "sendMessage", {
        chat_id: chatId,
        text: chunk,
        parse_mode: "Markdown",
        reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined
      });
      if (!res.ok) {
        await tgRequest(botToken, "sendMessage", {
          chat_id: chatId,
          text: chunk,
          reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined
        });
      }
    }
  }
}

function chunkString(str, size) {
  const numChunks = Math.ceil(str.length / size);
  const chunks = new Array(numChunks);
  for (let i = 0, c = 0; c < numChunks; ++c, i += size) {
    chunks[c] = str.substr(i, size);
  }
  return chunks;
}

// ==========================================
// ۴. پردازش ساخت عکس
// ==========================================
async function processImageRequest(botToken, env, chatId, userId, promptText, targetKeyId) {
  const imgModels = JSON.parse((await safeKvGet(env, "IMAGE_MODELS")) || "[]");
  let imgIdx = parseInt((await safeKvGet(env, `USER_IMG_MODEL_${targetKeyId}`)) || (await safeKvGet(env, `USER_IMG_MODEL_${userId}`)) || "0");
  if (!imgModels[imgIdx]) imgIdx = 0;

  if (imgModels.length === 0 || !imgModels[imgIdx]) {
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "⚠️ هیچ مدل تصویرسازی تعریف نشده است." });
    return;
  }

  const activeImgModel = imgModels[imgIdx];
  const statusRes = await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "🎨 در حال ساخت تصویر... (۵ ثانیه)" });
  const statusMsgId = statusRes.result?.message_id;

  let seconds = 5;
  let isDone = false;
  let imageUrl = null;
  let errorMessage = null;

  const timerPromise = (async () => {
    while (!isDone && seconds < 120) {
      await sleep(5000);
      if (isDone) break;
      seconds += 5;
      if (statusMsgId) {
        try {
          await tgRequest(botToken, "editMessageText", {
            chat_id: chatId,
            message_id: statusMsgId,
            text: `🎨 در حال ساخت تصویر... (${seconds} ثانیه)`
          });
        } catch (e) {}
      }
    }
  })();

  try {
    const modelName = (activeImgModel.modelName || "").trim();
    const baseUrl = (activeImgModel.baseUrl || "").trim().replace(/\/+$/, "");
    const apiKey = (activeImgModel.apiKey || "").trim();

    if (baseUrl.includes("pollinations.ai")) {
      imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}`;
    } else {
      const endpoint = baseUrl.endsWith("/images/generations") ? baseUrl : `${baseUrl}/images/generations`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelName, prompt: promptText, n: 1, size: "1024x1024" })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data[0]) {
          imageUrl = data.data[0].url || (data.data[0].b64_json ? `data:image/jpeg;base64,${data.data[0].b64_json}` : null);
        }
      } else {
        errorMessage = `خطای سرویس تصویر: ${res.status}`;
      }
    }
  } catch (e) {
    errorMessage = e.message;
  } finally {
    isDone = true;
  }

  await timerPromise;

  if (imageUrl) {
    if (statusMsgId) await tgRequest(botToken, "deleteMessage", { chat_id: chatId, message_id: statusMsgId });
    await tgRequest(botToken, "sendPhoto", {
      chat_id: chatId,
      photo: imageUrl,
      caption: `✨ **تصویر تولید شده با ${activeImgModel.name}**\n\n📝 **پرامپت:** ${promptText}`
    });
  } else {
    await tgRequest(botToken, "editMessageText", {
      chat_id: chatId,
      message_id: statusMsgId,
      text: `❌ ساخت تصویر با خطا مواجه شد.\n${errorMessage || ""}`
    });
  }
}

// ==========================================
// ۵. پنل مدیریت ادمین و آمار
// ==========================================
async function sendAdminPanel(botToken, chatId) {
  const keyboard = [
    [{ text: "📊 آمار کاربران ربات و آنلاین", callback_data: "admin_stats" }],
    [{ text: "➕ افزودن مدل چت / Vision / کد", callback_data: "admin_add_model" }],
    [{ text: "🎨 افزودن مدل ساخت عکس", callback_data: "admin_add_img_model" }],
    [{ text: "📋 لیست و حذف مدل‌ها", callback_data: "admin_list_models" }],
    [{ text: "✏️ ویرایش مدل‌ها", callback_data: "admin_edit_models_menu" }],
    [{ text: "📢 افزودن کانال اسپانسری", callback_data: "admin_add_sponsor" }],
    [{ text: "🗑 حذف و لیست کانال‌های اسپانسری", callback_data: "admin_del_sponsor_menu" }],
    [{ text: "🚫 مسدودسازی کاربر", callback_data: "admin_ban_user" }],
    [{ text: "✅ لغو مسدودسازی کاربر", callback_data: "admin_unban_user" }],
    [{ text: "🔙 منوی اصلی", callback_data: "main_menu" }]
  ];

  await tgRequest(botToken, "sendMessage", {
    chat_id: chatId,
    text: "🛠 **پنل مدیریت ربات**",
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendBotStats(botToken, env, chatId) {
  const users = JSON.parse((await safeKvGet(env, "BOT_USERS")) || "[]");
  const totalUsers = users.length;
  
  let activeUsers = 0;
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  for (const uid of users) {
    const lastActive = await safeKvGet(env, `LAST_ACTIVE_${uid}`);
    if (lastActive && (now - parseInt(lastActive)) < twentyFourHours) {
      activeUsers++;
    }
  }

  const text = `📊 **آمار جامع کاربران ربات:**\n\n👥 کل کاربران ثبت‌نامی: **${totalUsers}**\n🟢 کاربران آنلاین / فعال (۲۴ ساعت گذشته): **${activeUsers}**`;
  const keyboard = [[{ text: "🔙 پنل ادمین", callback_data: "admin_panel" }]];

  await tgRequest(botToken, "sendMessage", {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendAdminModelsList(botToken, env, chatId, messageId = null) {
  const chatModels = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
  const imgModels = JSON.parse((await safeKvGet(env, "IMAGE_MODELS")) || "[]");
  let keyboard = [];

  chatModels.forEach((m, idx) => {
    keyboard.push([{ text: `🗑 حذف چت: ${m.name}`, callback_data: `del_model_${idx}` }]);
  });
  imgModels.forEach((m, idx) => {
    keyboard.push([{ text: `🗑 حذف عکس: ${m.name}`, callback_data: `del_img_model_${idx}` }]);
  });
  keyboard.push([{ text: "🔙 پنل ادمین", callback_data: "admin_panel" }]);

  const text = "📋 **لیست و حذف مدل‌ها:**";
  if (messageId) {
    await tgRequest(botToken, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard }
    });
  } else {
    await tgRequest(botToken, "sendMessage", {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard }
    });
  }
}

async function sendAdminEditModelsList(botToken, env, chatId) {
  const chatModels = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
  const imgModels = JSON.parse((await safeKvGet(env, "IMAGE_MODELS")) || "[]");
  let keyboard = [];

  chatModels.forEach((m, idx) => {
    keyboard.push([{ text: `✏️ ویرایش چت: ${m.name}`, callback_data: `edit_model_${idx}` }]);
  });
  imgModels.forEach((m, idx) => {
    keyboard.push([{ text: `✏️ ویرایش عکس: ${m.name}`, callback_data: `edit_img_model_${idx}` }]);
  });
  keyboard.push([{ text: "🔙 پنل ادمین", callback_data: "admin_panel" }]);

  await tgRequest(botToken, "sendMessage", {
    chat_id: chatId,
    text: "✏️ **مدلی که قصد ویرایش آن را دارید انتخاب کنید:**",
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendAdminSponsorList(botToken, env, chatId, messageId = null) {
  const channels = JSON.parse((await safeKvGet(env, "SPONSOR_CHANNELS")) || "[]");
  let listText = channels.length === 0 ? "📢 هیچ کانال اسپانسری ثبت نشده است." : "📢 **لیست کانال‌های اسپانسری:**";
  
  const keyboard = channels.map((ch, idx) => [
    { text: `🗑 حذف ${ch}`, callback_data: `del_sponsor_${idx}` }
  ]);
  keyboard.push([{ text: "🔙 پنل ادمین", callback_data: "admin_panel" }]);

  if (messageId) {
    await tgRequest(botToken, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: listText,
      reply_markup: { inline_keyboard: keyboard }
    });
  } else {
    await tgRequest(botToken, "sendMessage", {
      chat_id: chatId,
      text: listText,
      reply_markup: { inline_keyboard: keyboard }
    });
  }
}

async function handleAdminSteps(botToken, env, chatId, userId, text, step) {
  if (step === "ADD_MODEL_NAME") {
    await safeKvPut(env, `TEMP_MODEL_${userId}`, JSON.stringify({ name: text }));
    await safeKvPut(env, `ADMIN_STEP_${userId}`, "ADD_MODEL_URL");
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "🌐 **URL BASE** مربوط به API را وارد کنید:" });
  } else if (step === "ADD_MODEL_URL") {
    let temp = JSON.parse((await safeKvGet(env, `TEMP_MODEL_${userId}`)) || "{}");
    temp.baseUrl = text;
    await safeKvPut(env, `TEMP_MODEL_${userId}`, JSON.stringify(temp));
    await safeKvPut(env, `ADMIN_STEP_${userId}`, "ADD_MODEL_KEY");
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "🔑 **API KEY** را وارد کنید:" });
  } else if (step === "ADD_MODEL_KEY") {
    let temp = JSON.parse((await safeKvGet(env, `TEMP_MODEL_${userId}`)) || "{}");
    temp.apiKey = text;
    await safeKvPut(env, `TEMP_MODEL_${userId}`, JSON.stringify(temp));
    await safeKvPut(env, `ADMIN_STEP_${userId}`, "ADD_MODEL_ID");
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "📌 **MODEL NAME** اصلی را وارد کنید:" });
  } else if (step === "ADD_MODEL_ID") {
    let temp = JSON.parse((await safeKvGet(env, `TEMP_MODEL_${userId}`)) || "{}");
    temp.modelName = text;
    await safeKvPut(env, `TEMP_MODEL_${userId}`, JSON.stringify(temp));
    await safeKvPut(env, `ADMIN_STEP_${userId}`, "ADD_MODEL_VISION");
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "👁 آیا این مدل **Vision** دارد؟ (`yes` یا `no`)" });
  } else if (step === "ADD_MODEL_VISION") {
    let temp = JSON.parse((await safeKvGet(env, `TEMP_MODEL_${userId}`)) || "{}");
    temp.supportsVision = text.toLowerCase() === "yes";
    let models = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
    models.push(temp);
    await safeKvPut(env, "AI_MODELS", JSON.stringify(models));
    await clearUserState(env, userId);
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: `✅ مدل چت **${temp.name}** اضافه شد!` });
    await sendAdminPanel(botToken, chatId);
  } 
  else if (step === "ADD_IMG_NAME") {
    await safeKvPut(env, `TEMP_IMG_${userId}`, JSON.stringify({ name: text }));
    await safeKvPut(env, `ADMIN_STEP_${userId}`, "ADD_IMG_URL");
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "🌐 **URL BASE** تصویرساز را وارد کنید:" });
  } else if (step === "ADD_IMG_URL") {
    let temp = JSON.parse((await safeKvGet(env, `TEMP_IMG_${userId}`)) || "{}");
    temp.baseUrl = text;
    await safeKvPut(env, `TEMP_IMG_${userId}`, JSON.stringify(temp));
    await safeKvPut(env, `ADMIN_STEP_${userId}`, "ADD_IMG_KEY");
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "🔑 **API KEY** تصویرساز (اگر نیاز ندارد . بفرستید):" });
  } else if (step === "ADD_IMG_KEY") {
    let temp = JSON.parse((await safeKvGet(env, `TEMP_IMG_${userId}`)) || "{}");
    temp.apiKey = text === "." ? "" : text;
    await safeKvPut(env, `TEMP_IMG_${userId}`, JSON.stringify(temp));
    await safeKvPut(env, `ADMIN_STEP_${userId}`, "ADD_IMG_ID");
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "📌 **MODEL NAME** تصویرساز را وارد کنید:" });
  } else if (step === "ADD_IMG_ID") {
    let temp = JSON.parse((await safeKvGet(env, `TEMP_IMG_${userId}`)) || "{}");
    temp.modelName = text;
    let imgModels = JSON.parse((await safeKvGet(env, "IMAGE_MODELS")) || "[]");
    imgModels.push(temp);
    await safeKvPut(env, "IMAGE_MODELS", JSON.stringify(imgModels));
    await clearUserState(env, userId);
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: `🎨 مدل عکس **${temp.name}** اضافه شد!` });
    await sendAdminPanel(botToken, chatId);
  }
  else if (step === "EDIT_MODEL_NAME") {
    const idx = await safeKvGet(env, `ADMIN_EDIT_IDX_${userId}`);
    let models = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
    if (text !== "." && models[idx]) models[idx].name = text;
    await safeKvPut(env, "AI_MODELS", JSON.stringify(models));
    await safeKvPut(env, `ADMIN_STEP_${userId}`, "EDIT_MODEL_URL");
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "🌐 URL Base جدید (یا .):" });
  } else if (step === "EDIT_MODEL_URL") {
    const idx = await safeKvGet(env, `ADMIN_EDIT_IDX_${userId}`);
    let models = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
    if (text !== "." && models[idx]) models[idx].baseUrl = text;
    await safeKvPut(env, "AI_MODELS", JSON.stringify(models));
    await safeKvPut(env, `ADMIN_STEP_${userId}`, "EDIT_MODEL_KEY");
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "🔑 API Key جدید (یا .):" });
  } else if (step === "EDIT_MODEL_KEY") {
    const idx = await safeKvGet(env, `ADMIN_EDIT_IDX_${userId}`);
    let models = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
    if (text !== "." && models[idx]) models[idx].apiKey = text;
    await safeKvPut(env, "AI_MODELS", JSON.stringify(models));
    await safeKvPut(env, `ADMIN_STEP_${userId}`, "EDIT_MODEL_ID");
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "📌 Model Name جدید (یا .):" });
  } else if (step === "EDIT_MODEL_ID") {
    const idx = await safeKvGet(env, `ADMIN_EDIT_IDX_${userId}`);
    let models = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
    if (text !== "." && models[idx]) models[idx].modelName = text;
    await safeKvPut(env, "AI_MODELS", JSON.stringify(models));
    await safeKvPut(env, `ADMIN_STEP_${userId}`, "EDIT_MODEL_VISION");
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "👁 قابلیت Vision؟ (`yes` یا `no` یا .)" });
  } else if (step === "EDIT_MODEL_VISION") {
    const idx = await safeKvGet(env, `ADMIN_EDIT_IDX_${userId}`);
    let models = JSON.parse((await safeKvGet(env, "AI_MODELS")) || "[]");
    if (text !== "." && models[idx]) models[idx].supportsVision = text.toLowerCase() === "yes";
    await safeKvPut(env, "AI_MODELS", JSON.stringify(models));
    await clearUserState(env, userId);
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: "✅ مدل چت ویرایش شد!" });
    await sendAdminPanel(botToken, chatId);
  }
  else if (step === "ADD_SPONSOR") {
    let channels = JSON.parse((await safeKvGet(env, "SPONSOR_CHANNELS")) || "[]");
    const channelName = text.trim().startsWith("@") ? text.trim() : `@${text.trim()}`;
    if (!channels.includes(channelName)) {
      channels.push(channelName);
      await safeKvPut(env, "SPONSOR_CHANNELS", JSON.stringify(channels));
    }
    await clearUserState(env, userId);
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: `📢 کانال اسپانسر ${channelName} اضافه شد.` });
    await sendAdminPanel(botToken, chatId);
  } else if (step === "BAN_USER") {
    await safeKvPut(env, `BANNED_${text.trim()}`, "true");
    await clearUserState(env, userId);
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: `🚫 کاربر ${text} مسدود شد.` });
    await sendAdminPanel(botToken, chatId);
  } else if (step === "UNBAN_USER") {
    await safeKvDelete(env, `BANNED_${text.trim()}`);
    await clearUserState(env, userId);
    await tgRequest(botToken, "sendMessage", { chat_id: chatId, text: `✅ کاربر ${text} رفع مسدودی شد.` });
    await sendAdminPanel(botToken, chatId);
  }
}

// ==========================================
// ۶. توابع کمکی
// ==========================================
async function trackUserActivity(env, userId) {
  let users = JSON.parse((await safeKvGet(env, "BOT_USERS")) || "[]");
  if (!users.includes(userId)) {
    users.push(userId);
    await safeKvPut(env, "BOT_USERS", JSON.stringify(users));
  }
  await safeKvPut(env, `LAST_ACTIVE_${userId}`, Date.now().toString());
}

async function clearUserState(env, userId) {
  await Promise.all([
    safeKvDelete(env, `ADMIN_STEP_${userId}`),
    safeKvDelete(env, `TEMP_MODEL_${userId}`),
    safeKvDelete(env, `TEMP_IMG_${userId}`),
    safeKvDelete(env, `ADMIN_EDIT_IDX_${userId}`),
    safeKvDelete(env, `ADMIN_EDIT_IMG_IDX_${userId}`)
  ]);
}

async function getOrCreateActiveSession(env, userId) {
  let activeId = await safeKvGet(env, `ACTIVE_SESSION_${userId}`);
  if (!activeId) {
    activeId = `sess_${Date.now()}`;
    await safeKvPut(env, `ACTIVE_SESSION_${userId}`, activeId);
    let sessions = JSON.parse((await safeKvGet(env, `SESSIONS_${userId}`)) || "[]");
    sessions.unshift({ id: activeId, title: "گفتگوی جدید 💬", date: new Date().toLocaleDateString('fa-IR') });
    await safeKvPut(env, `SESSIONS_${userId}`, JSON.stringify(sessions));
  }
  return activeId;
}

async function updateSessionTitleIfNew(env, userId, sessionId, firstMsg) {
  let sessions = JSON.parse((await safeKvGet(env, `SESSIONS_${userId}`)) || "[]");
  const session = sessions.find(s => s.id === sessionId);
  if (session && session.title === "گفتگوی جدید 💬") {
    session.title = firstMsg.slice(0, 22) + (firstMsg.length > 22 ? "..." : "");
    await safeKvPut(env, `SESSIONS_${userId}`, JSON.stringify(sessions));
  }
}

async function tgRequest(token, method, body) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e) {
    console.error("TG Request Error:", e);
    return { ok: false };
  }
}

async function checkSponsorJoin(botToken, env, userId) {
  const channelsRaw = await safeKvGet(env, "SPONSOR_CHANNELS");
  let channels = [];
  try {
    channels = JSON.parse(channelsRaw) || [];
  } catch (e) {
    if (channelsRaw) channels = [channelsRaw];
  }

  if (channels.length === 0) return { ok: true, unjoined: [] };

  let unjoined = [];
  for (const ch of channels) {
    const formattedCh = ch.startsWith("@") ? ch : `@${ch}`;
    try {
      const res = await tgRequest(botToken, "getChatMember", {
        chat_id: formattedCh,
        user_id: userId
      });
      if (!res.ok || !["creator", "administrator", "member"].includes(res.result?.status)) {
        unjoined.push(formattedCh);
      }
    } catch (e) {}
  }

  return { ok: unjoined.length === 0, unjoined };
}

async function getTelegramFileBase64(botToken, fileId) {
  try {
    const fileResJson = await tgRequest(botToken, "getFile", { file_id: fileId });
    if (!fileResJson.ok || !fileResJson.result?.file_path) return null;
    const filePath = fileResJson.result.file_path;
    const imgRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    const arrayBuffer = await imgRes.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  } catch (e) {
    console.error("Base64 Error:", e);
    return null;
  }
}

async function getTelegramFileText(botToken, fileId) {
  try {
    const fileResJson = await tgRequest(botToken, "getFile", { file_id: fileId });
    if (!fileResJson.ok || !fileResJson.result?.file_path) return null;
    const filePath = fileResJson.result.file_path;
    const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    if (fileRes.ok) return await fileRes.text();
  } catch (e) {}
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
