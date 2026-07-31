/**
 * Mailly OTP - Google Apps Script backend
 */

const CONFIG = {
  SHEET_ID: '14vKp2IjcYMUH93vztapNx87nuTM39BdesEuZFGPL5HY',
  PROMPTPAY_ID: '0633390911',
  SLIP_FOLDER_ID: '',
  ADMIN_USERNAME: 'admin',

  SESSION_HOURS: 72,
  PASSWORD_HASH_ROUNDS: 1200,

  MIN_TOPUP: 50,
  DEFAULT_MARKUP: 2,
  DEFAULT_MIN_PRICE_THB: 7,
  // OTP-sms permits a refunded cancellation after five minutes.
  CANCEL_UNLOCK_SECONDS: 300,
  // An activation that has no SMS after this period is cancelled and refunded.
  AUTO_REFUND_SECONDS: 20 * 60,

  SELLING_PRICE_RULES: [
    { maxUsd: 0.09, thb: 7 },
    { maxUsd: 0.29, thb: 10 },
    { maxUsd: 0.44, thb: 15 },
    { maxUsd: 0.60, thb: 20 },
    { maxUsd: 0.80, thb: 30 },
    { maxUsd: Infinity, thb: 45 }
  ],

  OTP_SMS: {
    base: 'https://otp-sms.com/api/v1/',
    services: 'getServices.php',
    countries: 'getCountries.php',
    prices: 'getPrices.php',
    purchase: 'getNumber.php',
    status: 'getStatus.php',
    setStatus: 'setStatus.php'
  },

  SHOPNOI: {
    base: 'https://shopnoi.com/api/',
    profile: 'profile.php',
    products: 'products.php',
    product: 'product.php',
    order: 'order.php',
    purchase: 'buy_product'
  }
};

const SCHEMAS = {
  Users: [
    'userId',
    'email',
    'balance',
    'createdAt',
    'status',
    'passwordHash',
    'passwordSalt',
    'passwordSetAt',
    'sessionHash',
    'sessionExpiresAt',
    'failedAttempts',
    'lockedUntil',
    'username',
    'credit',
    'updated_at',
    'active'
  ],

  Orders: [
    'orderId',
    'smspoolOrderId',
    'service',
    'country',
    'phone',
    'status',
    'price',
    'userId',
    'createdAt',
    'updatedAt',
    'service_id',
    'country_id',
    'cc',
    'phonenumber',
    'cost_usd',
    'sms',
    'cancel_unlock_at',
    'refunded_at',
    'provider',
    'provider_id',
    'provider_status'
  ],

  Transactions: [
    'transactionId',
    'userId',
    'amount',
    'type',
    'status',
    'reference',
    'createdAt'
  ],

  Settings: [
    'key',
    'value',
    'updatedAt'
  ],

  Logs: [
    'time',
    'action',
    'requestId',
    'error',
    'details'
  ],

  Topups: [
    'topup_id',
    'username',
    'amount',
    'status',
    'slip_url',
    'created_at',
    'reviewed_at',
    'note'
  ],

  Products: [
    'product_id',
    'name',
    'description',
    'category',
    'price',
    'icon',
    'logo_url',
    'active'
  ],

  ProductStock: [
    'stock_id',
    'product_id',
    'item_data',
    'sold',
    'created_at',
    'sold_at'
  ],

  Purchases: [
    'purchase_id',
    'username',
    'product_id',
    'product_name',
    'price',
    'item_data',
    'created_at',
    'quantity',
    'provider',
    'provider_order_id',
    'status',
    'coupon',
    'updated_at',
    'error_message'
  ],

  YTData: [
    'username',
    'family_id',
    'email',
    'status',
    'expire_date',
    'slip_url',
    'updated_at'
  ],

  Inbox: [
    'message_id',
    'username',
    'message',
    'created_at'
  ]
};

function doGet() {
  return json_({
    success: true,
    service: 'Mailly OTP backend',
    time: new Date().toISOString()
  });
}

function doPost(e) {
  const requestId = newId_('REQ');
  let action = 'unknown';

  try {
    const body = JSON.parse(
      (e && e.postData && e.postData.contents) || '{}'
    );

    action = String(body.action || '');
    const p = body.payload || {};

    if (!action) {
      return json_({
        success: false,
        message: 'ไม่พบ action'
      });
    }

    const result = dispatch_(action, p);

    log_(action, requestId, '', {
      success: true
    });

    return json_(
      Object.assign(
        {
          requestId: requestId
        },
        result
      )
    );

  } catch (err) {
    const message = safeError_(err);

    console.error(err.stack || err);

    log_(action, requestId, message, {});

    return json_({
      success: false,
      requestId: requestId,
      message: message
    });
  }
}

function dispatch_(action, p) {
  switch (action) {
    case 'loginUser':
      return loginUser_(p);

    case 'registerUser':
      return registerUser_(p);

    case 'getSessionUser':
      return getSessionUser_(p);

    case 'logoutUser':
      return logoutUser_(p);

    case 'getMyOrders':
      return getMyOrders_(p);

    case 'getRecentSales':
      return getRecentSales_(p);

    case 'getLoginStats':
      return getLoginStats_();

    case 'getPriceQuote':
      return getPriceQuote_(p);

    case 'getProviderOptions':
      return getProviderOptions_(p);

    case 'getServices':
      return getServices_(p);

    case 'getCountryDataForService':
      return getCountries_(p);

    case 'buyNumberWithCredit':
      return buyNumber_(p);

    case 'buyKeepNumberWithCredit':
      return buyKeepNumber_(p);

    case 'checkOTP':
      return checkOtp_(p);

    case 'cancelOrderWithRefund':
      return cancelOrder_(p);

    case 'resendSMSWithCredit':
      return resendSms_(p);

    case 'topupUserCredit':
      return createTopup_(p);

    case 'buyProductWithCredit':
      return buyProduct_(p);

    case 'getStoreCatalog':
      return getShopnoiCatalog_(p);

    case 'getStoreProduct':
      return getShopnoiProduct_(p);

    case 'buyStoreProductWithCredit':
      return buyShopnoiProduct_(p);

    case 'getMyStorePurchases':
      return getMyShopnoiPurchases_(p);

    case 'getYtUserData':
      return getYtUserData_(p);

    case 'getAllYtDataForAdmin':
      return getAllYtDataForAdmin_(p);

    case 'updateYtUserDataFromAdmin':
      return updateYtUserDataFromAdmin_(p);

    case 'processYtPayment':
      return processYtPayment_(p);

    case 'getUserInboxMessages':
      return getInbox_(p);

    case 'sendUserInboxMessage':
      return sendInbox_(p);

    case 'requestBackupEmail':
      return requestBackupEmail_(p);

    case 'getSettings':
      return getSettings_();

    case 'setSetting':
      return setSetting_(p);

    default:
      return {
        success: false,
        message: 'ไม่รองรับ action: ' + action
      };
  }
}

/* =====================================================
   SETUP GOOGLE SHEETS
===================================================== */

function setupSheets() {
  const ss = spreadsheet_();

  Object.keys(SCHEMAS).forEach(function(name) {
    let sh = ss.getSheetByName(name);

    if (!sh) {
      sh = ss.insertSheet(name);
    }

    const headers = SCHEMAS[name];

    if (sh.getLastRow() === 0) {
      sh
        .getRange(1, 1, 1, headers.length)
        .setValues([headers]);
    } else {
      ensureSchemaHeaders_(sh, headers);
    }

    sh.setFrozenRows(1);
  });

  migrateLegacyUserSheet_();
  seedSettings_();
  ensureAutoRefundTrigger_();

  return 'สร้าง/ตรวจสอบชีตและตั้งงานคืนเครดิตอัตโนมัติเรียบร้อยแล้ว';
}

// Run by the Apps Script time trigger.  It is deliberately public because
// installable triggers execute without a browser request.
function autoRefundExpiredOrders() {
  return processExpiredOrders_();
}

function ensureAutoRefundTrigger_() {
  const exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'autoRefundExpiredOrders';
  });
  if (!exists) {
    ScriptApp.newTrigger('autoRefundExpiredOrders').timeBased().everyMinutes(1).create();
  }
}

function ensureSchemaHeaders_(sh, requiredHeaders) {
  const current = headerRow_(sh);

  const missing = requiredHeaders.filter(function(h) {
    return current.indexOf(h) < 0;
  });

  if (missing.length) {
    sh
      .getRange(
        1,
        current.length + 1,
        1,
        missing.length
      )
      .setValues([missing]);
  }
}

function migrateLegacyUserSheet_() {
  const ss = spreadsheet_();
  const legacy = ss.getSheetByName('User');
  const target = ss.getSheetByName('Users');

  if (
    !legacy ||
    !target ||
    target.getLastRow() > 1 ||
    legacy.getLastRow() < 2
  ) {
    return;
  }

  const values = legacy.getDataRange().getValues();
  const headers = values[0].map(String);

  const idx = function(names) {
    return names
      .map(function(n) {
        return headers.indexOf(n);
      })
      .find(function(i) {
        return i >= 0;
      });
  };

  for (let r = 1; r < values.length; r++) {
    const userIndex = idx([
      'userId',
      'username',
      'user_id'
    ]);

    const userId =
      userIndex >= 0
        ? values[r][userIndex]
        : values[r][0];

    if (!userId) continue;

    const emailIndex = idx(['email']);
    const balanceIndex = idx([
      'balance',
      'credit'
    ]);

    const balance =
      balanceIndex >= 0
        ? values[r][balanceIndex]
        : 0;

    append_('Users', {
      userId: userId,
      username: userId,
      email:
        emailIndex >= 0
          ? values[r][emailIndex]
          : '',
      balance: balance,
      credit: balance,
      createdAt: now_(),
      status: 'active'
    });
  }
}

/* =====================================================
   DATABASE HELPERS
===================================================== */

function spreadsheet_() {
  if (
    !CONFIG.SHEET_ID ||
    CONFIG.SHEET_ID.indexOf('ใส่_') === 0
  ) {
    throw new Error(
      'กรุณาใส่ SHEET_ID ใน CONFIG'
    );
  }

  return SpreadsheetApp.openById(
    CONFIG.SHEET_ID
  );
}

function sheet_(name) {
  const sh = spreadsheet_().getSheetByName(name);

  if (!sh) {
    throw new Error(
      'ไม่พบชีต ' +
      name +
      ' กรุณารัน setupSheets()'
    );
  }

  return sh;
}

function rows_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map(String);

  return values.slice(1).map(function(row, i) {
    const obj = {
      _row: i + 2
    };

    headers.forEach(function(h, j) {
      obj[h] = row[j];
    });

    alias_(obj, 'userId', [
      'username',
      'user_id'
    ]);

    alias_(obj, 'username', [
      'userId',
      'user_id'
    ]);

    alias_(obj, 'balance', ['credit']);
    alias_(obj, 'credit', ['balance']);

    alias_(obj, 'createdAt', [
      'created_at'
    ]);

    alias_(obj, 'created_at', [
      'createdAt'
    ]);

    alias_(obj, 'orderId', ['order_id']);
    alias_(obj, 'order_id', ['orderId']);

    alias_(obj, 'smspoolOrderId', [
      'provider_order_id'
    ]);

    alias_(obj, 'provider_order_id', [
      'smspoolOrderId'
    ]);

    alias_(obj, 'service', [
      'service_name'
    ]);

    alias_(obj, 'service_name', [
      'service'
    ]);

    alias_(obj, 'country', [
      'country_name'
    ]);

    alias_(obj, 'country_name', [
      'country'
    ]);

    alias_(obj, 'phone', [
      'phonenumber'
    ]);

    alias_(obj, 'phonenumber', [
      'phone'
    ]);

    alias_(obj, 'price', [
      'price_thb'
    ]);

    alias_(obj, 'price_thb', [
      'price'
    ]);

    return obj;
  });
}

function alias_(obj, primary, alternatives) {
  if (
    obj[primary] !== undefined &&
    obj[primary] !== ''
  ) {
    return;
  }

  for (
    let i = 0;
    i < alternatives.length;
    i++
  ) {
    if (
      obj[alternatives[i]] !== undefined &&
      obj[alternatives[i]] !== ''
    ) {
      obj[primary] = obj[alternatives[i]];
      return;
    }
  }
}

function append_(name, obj) {
  const sh = sheet_(name);
  const headers = headerRow_(sh);

  sh.appendRow(
    headers.map(function(h) {
      return valueForHeader_(obj, h);
    })
  );
}

function updateRow_(name, rowNumber, obj) {
  const sh = sheet_(name);
  const headers = headerRow_(sh);

  const current = sh
    .getRange(
      rowNumber,
      1,
      1,
      headers.length
    )
    .getValues()[0];

  const next = headers.map(function(h, i) {
    return hasValueForHeader_(obj, h)
      ? valueForHeader_(obj, h)
      : current[i];
  });

  sh
    .getRange(
      rowNumber,
      1,
      1,
      headers.length
    )
    .setValues([next]);
}

function headerRow_(sh) {
  return sh
    .getRange(
      1,
      1,
      1,
      sh.getLastColumn()
    )
    .getValues()[0]
    .map(String);
}

function headerAliases_(header) {
  const map = {
    userId: [
      'userId',
      'username',
      'user_id'
    ],

    email: ['email'],

    balance: [
      'balance',
      'credit'
    ],

    credit: [
      'credit',
      'balance'
    ],

    createdAt: [
      'createdAt',
      'created_at'
    ],

    created_at: [
      'created_at',
      'createdAt'
    ],

    updatedAt: [
      'updatedAt',
      'updated_at'
    ],

    updated_at: [
      'updated_at',
      'updatedAt'
    ],

    orderId: [
      'orderId',
      'order_id'
    ],

    order_id: [
      'order_id',
      'orderId'
    ],

    smspoolOrderId: [
      'smspoolOrderId',
      'provider_order_id'
    ],

    provider_order_id: [
      'provider_order_id',
      'smspoolOrderId'
    ],

    service: [
      'service',
      'service_name'
    ],

    service_name: [
      'service_name',
      'service'
    ],

    country: [
      'country',
      'country_name'
    ],

    country_name: [
      'country_name',
      'country'
    ],

    phone: [
      'phone',
      'phonenumber'
    ],

    phonenumber: [
      'phonenumber',
      'phone'
    ],

    price: [
      'price',
      'price_thb'
    ],

    price_thb: [
      'price_thb',
      'price'
    ],

    time: [
      'time',
      'timestamp'
    ],

    requestId: [
      'requestId',
      'request_id'
    ],

    error: ['error'],
    details: ['details']
  };

  return map[header] || [header];
}

function hasValueForHeader_(obj, header) {
  return headerAliases_(header).some(
    function(k) {
      return obj[k] !== undefined;
    }
  );
}

function valueForHeader_(obj, header) {
  const aliases = headerAliases_(header);

  for (
    let i = 0;
    i < aliases.length;
    i++
  ) {
    if (obj[aliases[i]] !== undefined) {
      return obj[aliases[i]];
    }
  }

  return '';
}

function now_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() ||
      'Asia/Bangkok',
    'yyyy-MM-dd HH:mm:ss'
  );
}

function money_(n) {
  return (
    Math.round(
      (Number(n) || 0) * 100
    ) / 100
  );
}

function key_(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

function json_(obj) {
  return ContentService
    .createTextOutput(
      JSON.stringify(obj)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

function safeError_(e) {
  return String(
    (e && e.message) || e
  ).replace(
    /https?:\/\/[^\s]+/g,
    '[url]'
  );
}

function newId_(prefix) {
  return (
    prefix +
    '-' +
    Utilities.getUuid()
      .replace(/-/g, '')
      .slice(0, 18)
      .toUpperCase()
  );
}

/* =====================================================
   SETTINGS / LOGS / TRANSACTIONS
===================================================== */

function seedSettings_() {
  const sh = sheet_('Settings');

  if (sh.getLastRow() > 1) {
    return;
  }

  [
    [
      'markup',
      CONFIG.DEFAULT_MARKUP
    ],
    [
      'min_price_thb',
      CONFIG.DEFAULT_MIN_PRICE_THB
    ],
    [
      'service_enabled',
      'true'
    ],
    [
      'maintenance',
      'false'
    ]
  ].forEach(function(x) {
    append_('Settings', {
      key: x[0],
      value: x[1],
      updatedAt: now_()
    });
  });
}

function setting_(key, fallback) {
  const r = rows_('Settings').find(
    function(x) {
      return (
        String(x.key) === String(key)
      );
    }
  );

  return r && r.value !== ''
    ? r.value
    : fallback;
}

function log_(
  action,
  requestId,
  error,
  details
) {
  try {
    append_('Logs', {
      time: now_(),
      action: action,
      requestId: requestId,
      error: error || '',
      details: JSON.stringify(
        details || {}
      )
    });
  } catch (e) {
    console.error(e);
  }
}

function transaction_(
  userId,
  amount,
  type,
  status,
  reference
) {
  append_('Transactions', {
    transactionId: newId_('TXN'),
    userId: userId,
    amount: money_(amount),
    type: type,
    status: status,
    reference: reference || '',
    createdAt: now_()
  });
}

function getSettings_() {
  return rows_('Settings').map(
    function(r) {
      return {
        key: r.key,
        value: r.value,
        updatedAt:
          r.updatedAt ||
          r.updated_at
      };
    }
  );
}

function setSetting_(p) {
  if (
    key_(p.adminUsername) !==
    key_(CONFIG.ADMIN_USERNAME)
  ) {
    throw new Error(
      'ไม่มีสิทธิ์แก้ไข Settings'
    );
  }

  const row = rows_('Settings').find(
    function(r) {
      return (
        String(r.key) ===
        String(p.key)
      );
    }
  );

  if (row) {
    updateRow_(
      'Settings',
      row._row,
      {
        value: p.value,
        updatedAt: now_()
      }
    );
  } else {
    append_('Settings', {
      key: p.key,
      value: p.value,
      updatedAt: now_()
    });
  }

  return {
    success: true
  };
}

/* =====================================================
   USER / CREDIT
===================================================== */

function user_(username, create) {
  username = String(
    username || ''
  ).trim();

  if (
    !/^[\wก-๙. -]{2,50}$/u.test(
      username
    )
  ) {
    throw new Error(
      'ชื่อผู้ใช้ไม่ถูกต้อง'
    );
  }

  const k = key_(username);
  const list = rows_('Users');

  let found = list.find(function(r) {
    return (
      key_(
        r.userId || r.username
      ) === k
    );
  });

  if (!found && create) {
    append_('Users', {
      userId: username,
      username: username,
      email: '',
      balance: 0,
      credit: 0,
      createdAt: now_(),
      created_at: now_(),
      status: 'active',
      updated_at: now_(),
      active: true
    });

    found = rows_('Users').find(
      function(r) {
        return (
          key_(
            r.userId ||
            r.username
          ) === k
        );
      }
    );
  }

  if (
    !found ||
    String(
      found.active ||
      found.status
    ).toLowerCase() === 'false' ||
    String(
      found.status
    ).toLowerCase() === 'suspended'
  ) {
    throw new Error(
      'ไม่พบผู้ใช้งานหรือบัญชีถูกระงับ'
    );
  }

  found.username =
    found.userId ||
    found.username;

  found.credit =
    Number(
      found.balance !== undefined &&
      found.balance !== ''
        ? found.balance
        : found.credit
    ) || 0;

  return found;
}

function changeCredit_(
  username,
  delta
) {
  const u = user_(
    username,
    true
  );

  const next = money_(
    Number(u.credit) +
    Number(delta)
  );

  if (next < -0.0001) {
    throw new Error(
      'เครดิตไม่เพียงพอ'
    );
  }

  updateRow_(
    'Users',
    u._row,
    {
      balance: next,
      credit: next,
      updated_at: now_(),
      updatedAt: now_()
    }
  );

  transaction_(
    u.username,
    delta,
    Number(delta) >= 0
      ? 'credit'
      : 'debit',
    'completed',
    'balance'
  );

  return next;
}

/* =====================================================
   LOGIN / REGISTER / SESSION
===================================================== */

function loginUser_(p) {
  const username = String(
    p.username || ''
  ).trim();

  const password = String(
    p.password || ''
  );

  if (!username || !password) {
    throw new Error(
      'กรุณากรอก Username และ Password'
    );
  }

  const u = user_(
    username,
    false
  );

  if (
    !u.passwordHash ||
    !u.passwordSalt
  ) {
    return {
      success: false,
      needsPasswordSetup: true,
      message:
        'บัญชีเดิมนี้ยังไม่มีรหัสผ่าน กรุณาเลือกสมัครสมาชิกเพื่อตั้งรหัสผ่านครั้งแรก'
    };
  }

  const lockedUntil =
    new Date(
      u.lockedUntil || 0
    ).getTime();

  if (
    lockedUntil > Date.now()
  ) {
    throw new Error(
      'บัญชีถูกล็อกชั่วคราว กรุณารอ 15 นาทีแล้วลองใหม่'
    );
  }

  const attemptedHash =
    passwordHash_(
      password,
      u.passwordSalt
    );

  if (
    !constantTimeEqual_(
      attemptedHash,
      String(u.passwordHash)
    )
  ) {
    const failed =
      Number(
        u.failedAttempts || 0
      ) + 1;

    updateRow_(
      'Users',
      u._row,
      {
        failedAttempts:
          failed >= 5
            ? 0
            : failed,

        lockedUntil:
          failed >= 5
            ? new Date(
                Date.now() +
                15 * 60 * 1000
              )
            : ''
      }
    );

    throw new Error(
      failed >= 5
        ? 'รหัสผ่านไม่ถูกต้อง บัญชีถูกล็อก 15 นาที'
        : 'Username หรือ Password ไม่ถูกต้อง'
    );
  }

  updateRow_(
    'Users',
    u._row,
    {
      failedAttempts: 0,
      lockedUntil: ''
    }
  );

  return createSessionResponse_(u);
}

function registerUser_(p) {
  const username = String(
    p.username || ''
  ).trim();

  const email = String(
    p.email || ''
  )
    .trim()
    .toLowerCase();

  const password = String(
    p.password || ''
  );

  const confirmPassword = String(
    p.confirmPassword || ''
  );

  if (
    !/^[A-Za-z0-9_.-]{3,24}$/.test(
      username
    )
  ) {
    throw new Error(
      'Username ต้องมี 3–24 ตัว และใช้ได้เฉพาะ a-z, 0-9, จุด ขีดกลาง หรือขีดล่าง'
    );
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new Error(
      'รูปแบบ Email ไม่ถูกต้อง'
    );
  }

  validatePassword_(password);

  if (
    password !== confirmPassword
  ) {
    throw new Error(
      'ยืนยัน Password ไม่ตรงกัน'
    );
  }

  const users = rows_('Users');

  let u = users.find(function(r) {
    return (
      key_(
        r.userId ||
        r.username
      ) === key_(username)
    );
  });

  const emailOwner = users.find(
    function(r) {
      return (
        key_(r.email) ===
          key_(email) &&
        key_(
          r.userId ||
          r.username
        ) !== key_(username)
      );
    }
  );

  if (emailOwner) {
    throw new Error(
      'Email นี้ถูกใช้กับบัญชีอื่นแล้ว'
    );
  }

  if (
    u &&
    u.passwordHash
  ) {
    throw new Error(
      'Username นี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบ'
    );
  }

  if (
    u &&
    !u.email
  ) {
    throw new Error(
      'บัญชีเดิมนี้ยังไม่มี Email กรุณาให้แอดมินเพิ่ม Email ในชีต Users ก่อนตั้ง Password ครั้งแรก'
    );
  }

  if (
    u &&
    u.email &&
    key_(u.email) !== key_(email)
  ) {
    throw new Error(
      'Email ไม่ตรงกับข้อมูลสมาชิกเดิม กรุณาติดต่อแอดมิน'
    );
  }

  const salt = randomToken_();

  const hash = passwordHash_(
    password,
    salt
  );

  if (u) {
    updateRow_(
      'Users',
      u._row,
      {
        email: email,
        passwordHash: hash,
        passwordSalt: salt,
        passwordSetAt: now_(),
        status: 'active',
        active: true,
        updated_at: now_()
      }
    );
  } else {
    append_('Users', {
      userId: username,
      username: username,
      email: email,
      balance: 0,
      credit: 0,
      createdAt: now_(),
      status: 'active',
      active: true,
      passwordHash: hash,
      passwordSalt: salt,
      passwordSetAt: now_(),
      failedAttempts: 0
    });
  }

  u = user_(
    username,
    false
  );

  transaction_(
    username,
    0,
    'register',
    'completed',
    'member-registration'
  );

  return createSessionResponse_(u);
}

function createSessionResponse_(u) {
  const token =
    randomToken_() +
    randomToken_();

  const expires =
    new Date(
      Date.now() +
      CONFIG.SESSION_HOURS *
      60 *
      60 *
      1000
    );

  updateRow_(
    'Users',
    u._row,
    {
      sessionHash:
        sha256_(token),

      sessionExpiresAt:
        expires,

      updated_at: now_()
    }
  );

  return {
    success: true,
    token: token,
    expiresAt:
      expires.toISOString(),
    user: publicUser_(u)
  };
}

function getSessionUser_(p) {
  return {
    success: true,
    user: publicUser_(
      requireAuth_(p)
    )
  };
}

function logoutUser_(p) {
  const u = requireAuth_(p);

  updateRow_(
    'Users',
    u._row,
    {
      sessionHash: '',
      sessionExpiresAt: ''
    }
  );

  return {
    success: true
  };
}

function requireAuth_(p) {
  const token = String(
    (p && p.token) || ''
  );

  if (!token) {
    throw new Error(
      'กรุณาเข้าสู่ระบบใหม่'
    );
  }

  const tokenHash =
    sha256_(token);

  const raw = rows_('Users').find(
    function(r) {
      return (
        r.sessionHash &&
        constantTimeEqual_(
          String(r.sessionHash),
          tokenHash
        )
      );
    }
  );

  if (
    !raw ||
    new Date(
      raw.sessionExpiresAt || 0
    ).getTime() <= Date.now()
  ) {
    throw new Error(
      'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่'
    );
  }

  return user_(
    raw.userId ||
    raw.username,
    false
  );
}

function publicUser_(u) {
  const balance = money_(
    u.balance !== undefined &&
    u.balance !== ''
      ? u.balance
      : u.credit
  );

  return {
    userId:
      u.userId ||
      u.username,

    username:
      u.userId ||
      u.username,

    email:
      u.email || '',

    balance: balance,
    credit: balance
  };
}

function validatePassword_(password) {
  if (
    password.length < 8 ||
    password.length > 72
  ) {
    throw new Error(
      'Password ต้องมี 8–72 ตัวอักษร'
    );
  }

  if (
    !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    throw new Error(
      'Password ต้องมีทั้งตัวอักษรและตัวเลข'
    );
  }
}

function randomToken_() {
  return (
    Utilities.getUuid()
      .replace(/-/g, '') +
    Utilities.getUuid()
      .replace(/-/g, '')
  );
}

function passwordHash_(
  password,
  salt
) {
  let value =
    String(salt) +
    '|' +
    String(password) +
    '|' +
    authPepper_();

  for (
    let i = 0;
    i <
    CONFIG.PASSWORD_HASH_ROUNDS;
    i++
  ) {
    value = sha256_(
      value + '|' + i
    );
  }

  return value;
}

function authPepper_() {
  const props =
    PropertiesService
      .getScriptProperties();

  let pepper =
    props.getProperty(
      'AUTH_PEPPER'
    );

  if (!pepper) {
    pepper = randomToken_();

    props.setProperty(
      'AUTH_PEPPER',
      pepper
    );
  }

  return pepper;
}

function sha256_(value) {
  const bytes =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm
        .SHA_256,
      String(value),
      Utilities.Charset.UTF_8
    );

  return bytes
    .map(function(b) {
      const v =
        b < 0
          ? b + 256
          : b;

      return (
        '0' +
        v.toString(16)
      ).slice(-2);
    })
    .join('');
}

function constantTimeEqual_(a, b) {
  a = String(a);
  b = String(b);

  let diff =
    a.length ^ b.length;

  const length =
    Math.max(
      a.length,
      b.length
    );

  for (
    let i = 0;
    i < length;
    i++
  ) {
    diff |=
      (
        a.charCodeAt(
          i % (a.length || 1)
        ) || 0
      ) ^
      (
        b.charCodeAt(
          i % (b.length || 1)
        ) || 0
      );
  }

  return diff === 0;
}

/* =====================================================
   OTP-SMS PROVIDER
===================================================== */

function orderView_(o) {
  return {
    order_id:
      o.orderId ||
      o.order_id,

    fullNumber:
      '+' +
      (o.cc || '') +
      ' ' +
      (
        o.phonenumber ||
        o.phone ||
        ''
      ),

    price: money_(
      o.price !== undefined
        ? o.price
        : o.price_thb
    ),

    time:
      o.createdAt ||
      o.created_at,

    status: o.status
  };
}

function otpSmsApiKey_() {
  const key = PropertiesService
    .getScriptProperties()
    .getProperty('OTP_SMS_API_KEY');

  if (!key) {
    throw new Error(
      'ยังไม่ได้ตั้งค่า OTP_SMS_API_KEY ใน Script Properties'
    );
  }

  return key;
}

function otpSms_(
  path,
  params
) {
  params = params || {};
  params.api_key = otpSmsApiKey_();

  const options = {
    method: 'get',
    muteHttpExceptions: true
  };

  const response =
    UrlFetchApp.fetch(
      CONFIG.OTP_SMS.base +
        path +
        '?' +
        Object.keys(params)
          .map(function(key) {
            return encodeURIComponent(key) +
              '=' +
              encodeURIComponent(params[key]);
          })
          .join('&'),
      options
    );

  const code =
    response.getResponseCode();

  const text =
    response.getContentText();

  let body;

  try {
    body = JSON.parse(text);
  } catch (e) {
    throw new Error(
      'ระบบรับข้อมูลตอบกลับไม่ถูกต้อง'
    );
  }

  if (code >= 400 || !body.success) {
    throw new Error(
      body.message ||
      body.error ||
      'ไม่สามารถเชื่อมต่อระบบได้ (รหัส ' + code + ')'
    );
  }

  return body;
}

// Keep catalogue lookups responsive without weakening the purchase checks.
// CacheService is best-effort: a cache miss always falls back to the live
// provider, and buyNumber_ explicitly bypasses the short price cache.
function cachedJson_(key, seconds, loader, bypass) {
  const cache = CacheService.getScriptCache();
  if (!bypass) {
    const cached = cache.get(key);
    if (cached) {
      try { return JSON.parse(cached); } catch (_) {}
    }
  }
  const value = loader();
  try { cache.put(key, JSON.stringify(value), seconds); } catch (_) {}
  return value;
}

function serviceIsActive_(service) {
  if (!service || !service.code) return false;
  const active = service.active !== undefined
    ? service.active
    : service.is_active;
  const status = String(service.status || service.state || '').toLowerCase();

  if (active === false || active === 0 || active === '0' || String(active).toLowerCase() === 'false') {
    return false;
  }

  return ['inactive', 'disabled', 'deleted', 'archived'].indexOf(status) === -1;
}

function getServices_(p) {
  if (
    String(
      setting_(
        'service_enabled',
        'true'
      )
    ).toLowerCase() !== 'true'
  ) {
    throw new Error(
      'ระบบบริการ OTP ปิดชั่วคราว'
    );
  }

  p = p || {};
  return cachedJson_('mailly_catalogue_services_v2', 600, function() {
    const response = otpSms_(CONFIG.OTP_SMS.services, {});
    const seen = {};
    return (response.data.services || []).filter(serviceIsActive_).map(function(service) {
      return {
        ID: service.code,
        name: service.name_th || service.name || service.code,
        name_en: service.name || '',
        popular: Boolean(service.popular)
      };
    }).filter(function(service) {
      const id = String(service.ID || '');
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    });
  }, Boolean(p.refresh));
}

function getCountries_(p) {
  const serviceId =
    p.serviceId;

  if (!serviceId) {
    throw new Error(
      'ไม่พบ serviceId'
    );
  }

  // This is a global catalogue; actual availability is still fetched when a
  // customer selects the route and again immediately before purchase.
  const countries = cachedJson_('mailly_catalogue_countries_v2', 3600, function() {
    const response = otpSms_(CONFIG.OTP_SMS.countries, {});
    return (response.data.countries || []).map(function(country) {
      const iso2 = [
        country.iso2,
        country.iso_2,
        country.alpha2,
        country.alpha_2,
        country.country_code,
        country.code,
        country.flag
      ].map(function(value) {
        return String(value || '').trim().toUpperCase();
      }).filter(function(value) {
        return /^[A-Z]{2}$/.test(value);
      })[0] || '';
      const suppliedFlag = String(country.flag || '').trim();
      return {
        country_id: country.id,
        name: country.name_th || country.name || String(country.id),
        name_en: country.name || '',
        code: iso2,
        iso2: iso2,
        flag: suppliedFlag.length <= 4 && !/^[A-Za-z]{2}$/.test(suppliedFlag) ? suppliedFlag : '',
        popular: Boolean(country.popular)
      };
    });
  });

  // Return a named collection so doPost can append requestId without turning
  // that metadata field into a fake country in array/object conversions.
  return {
    success: true,
    countries: countries
  };
}

function priceFromThb_(thb) {
  const base = Number(thb);

  if (isNaN(base) || base < 0) {
    throw new Error('ระบบส่งราคาที่ไม่ถูกต้อง');
  }

  // Sell at the exact cost returned by OTP-sms. This same function is used
  // both for the provider cards and immediately before charging credit.
  return money_(base);
}

function priceOptions_(service, country, bypassCache) {
  if (!service || !country) {
    throw new Error('กรุณาเลือกบริการและประเทศ');
  }

  const cacheKey = 'mailly_prices_v2_' + service + '_' + country;
  return cachedJson_(cacheKey, 12, function() {
    let response;
    try {
      response = otpSms_(CONFIG.OTP_SMS.prices, { service: service, country: country });
    } catch (err) {
      const message = String(err && err.message || err || '');
      if (/service\s+not\s+found|service.*inactive/i.test(message)) {
        throw new Error('บริการนี้ยังไม่พร้อมใช้งาน กรุณาเลือกบริการอื่น');
      }
      if (/country\s+not\s+found|country.*inactive|not available.*country/i.test(message)) {
        throw new Error('ประเทศนี้ยังไม่พร้อมใช้งานสำหรับบริการที่เลือก');
      }
      throw err;
    }
    const options = response.data && Array.isArray(response.data.options)
      ? response.data.options : [];
    const available = options.filter(function(option) {
      return Number(option.count) > 0 && option.provider_id !== undefined;
    }).sort(function(a, b) { return Number(a.price) - Number(b.price); });
    if (!available.length) throw new Error('ไม่มีหมายเลขว่างสำหรับบริการและประเทศที่เลือก');
    return available;
  }, Boolean(bypassCache));
}

function getPriceQuote_(p) {
  requireAuth_(p);
  const options = priceOptions_(
    String(p.serviceId || ''),
    String(p.countryId || '')
  );
  const selected = options[0];

  return {
    success: true,
    price: priceFromThb_(selected.price),
    providerPriceThb: Number(selected.price),
    available: Number(selected.count)
  };
}

// Returns every currently available OTP-sms provider for the selected route.
// The browser receives display data only; price and provider are checked again
// in buyNumber_ immediately before an order is created.
function getProviderOptions_(p) {
  requireAuth_(p);

  const options = priceOptions_(
    String(p.serviceId || ''),
    String(p.countryId || '')
  );

  return {
    success: true,
    providers: options.map(function(option) {
      const providerId = String(option.provider_id);
      return {
        providerId: providerId,
        providerName: String(
          option.provider_name ||
          option.provider ||
          option.name ||
          ('Provider #' + providerId)
        ),
        price: priceFromThb_(option.price),
        providerPriceThb: Number(option.price),
        available: Number(option.count)
      };
    })
  };
}

function normalizeOtpSmsStatus_(result) {
  const raw = String(
    result.status ||
    result.activation_status ||
    result.state ||
    ''
  ).toLowerCase();

  if (result.sms_code || result.code || raw === 'completed' || raw === 'complete' || raw === 'success') {
    return 'completed';
  }
  if (['cancelled', 'canceled'].indexOf(raw) >= 0) return 'cancelled';
  if (raw === 'refunded') return 'refunded';
  if (['expired', 'timeout', 'timed_out'].indexOf(raw) >= 0) return 'expired';
  if (['waiting', 'pending', 'processing', 'resend', 'retry', 'active'].indexOf(raw) >= 0) return raw;

  // Keep an unknown upstream state visible instead of pretending the order is
  // still pending. This makes discrepancies diagnosable from the source data.
  return raw || 'pending';
}

function syncOtpSmsOrder_(order) {
  const current = String(order.status || '').toLowerCase();
  const finalStatuses = ['completed', 'cancelled', 'refunded', 'expired', 'failed'];
  if (finalStatuses.indexOf(current) >= 0) return order;

  try {
    requireOtpSmsOrder_(order);
    const response = otpSms_(CONFIG.OTP_SMS.status, {
      activation_id: order.smspoolOrderId || order.provider_order_id
    });
    const result = response.data || response || {};
    const nextStatus = normalizeOtpSmsStatus_(result);
    const sms = result.sms_code || result.code || order.sms || '';
    const providerStatus = String(result.status || result.activation_status || result.state || '');
    const updates = {
      status: nextStatus,
      sms: sms,
      provider_status: providerStatus,
      updatedAt: now_()
    };

    updateRow_('Orders', order._row, updates);
    Object.keys(updates).forEach(function(key) { order[key] = updates[key]; });

    // A received OTP is complete at the upstream provider too. This call is
    // best-effort; the stored OTP must remain available if closing it fails.
    if (nextStatus === 'completed' && providerStatus !== 'completed') {
      try {
        otpSms_(CONFIG.OTP_SMS.setStatus, {
          activation_id: order.smspoolOrderId || order.provider_order_id,
          action: 'complete'
        });
      } catch (ignore) {}
    }
  } catch (error) {
    // Do not replace a known status with a guessed value if the source is
    // temporarily unavailable. The next poll will try again.
    order.sync_error = safeError_(error);
  }

  return order;
}

function orderCreatedAt_(order) {
  const created = new Date(order.createdAt || order.created_at || 0).getTime();
  return Number.isNaN(created) ? 0 : created;
}

function cancelUnlockAt_(order) {
  const stored = new Date(order.cancel_unlock_at || 0).getTime();
  return stored || orderCreatedAt_(order) + CONFIG.CANCEL_UNLOCK_SECONDS * 1000;
}

function autoRefundOverdueOrder_(order) {
  const finalStatuses = ['completed', 'cancelled', 'refunded', 'expired', 'failed'];
  const status = String(order.status || '').toLowerCase();
  const createdAt = orderCreatedAt_(order);
  if (!createdAt) return false;
  const age = Date.now() - createdAt;
  if (finalStatuses.indexOf(status) >= 0 || order.sms || age < CONFIG.AUTO_REFUND_SECONDS * 1000) return false;

  requireOtpSmsOrder_(order);
  otpSms_(CONFIG.OTP_SMS.setStatus, {
    activation_id: order.smspoolOrderId || order.provider_order_id,
    action: 'cancel'
  });

  const newCredit = changeCredit_(order.userId || order.username, Number(order.price !== undefined ? order.price : order.price_thb));
  updateRow_('Orders', order._row, {
    status: 'refunded',
    refunded_at: now_(),
    updatedAt: now_(),
    provider_status: 'cancelled'
  });
  order.status = 'refunded';
  order.refunded_at = now_();
  order.provider_status = 'cancelled';
  return newCredit;
}

function processExpiredOrders_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { success: true, processed: 0 };
  try {
    let processed = 0;
    rows_('Orders').forEach(function(order) {
      const status = String(order.status || '').toLowerCase();
      if (['pending', 'waiting', 'processing', 'resend', 'retry', 'active', '1'].indexOf(status) < 0) return;
      syncOtpSmsOrder_(order);
      try {
        if (autoRefundOverdueOrder_(order) !== false) processed++;
      } catch (error) {
        console.warn('Auto-refund skipped for ' + (order.orderId || order.order_id) + ': ' + safeError_(error));
      }
    });
    return { success: true, processed: processed };
  } finally {
    lock.releaseLock();
  }
}

function getMyOrders_(p) {
  const u = requireAuth_(p);
  // Covers the short period between the one-minute background runs as well.
  processExpiredOrders_();

  const items = rows_('Orders')
    .filter(function(o) {
      return (
        key_(
          o.userId ||
          o.username
        ) ===
        key_(u.username)
      );
    })
    .slice(-30)
    .reverse()
    .map(syncOtpSmsOrder_)
    .map(function(o) {
      return {
        orderId:
          o.orderId ||
          o.order_id,

        service:
          o.service ||
          o.service_name ||
          '',

        country:
          o.country ||
          o.country_name ||
          '',

        phone:
          (
            o.cc
              ? '+' + o.cc
              : ''
          ) +
          String(
            o.phonenumber ||
            o.phone ||
            ''
          ),

        status:
          o.status || '',

        providerStatus:
          o.provider_status || '',

        price:
          money_(
            o.price !== undefined
              ? o.price
              : o.price_thb
          ),

        sms:
          o.sms || '',

        cancelUnlockAt: new Date(cancelUnlockAt_(o)).toISOString(),
        expiresAt: new Date(orderCreatedAt_(o) + CONFIG.AUTO_REFUND_SECONDS * 1000).toISOString(),
        canCancel: Date.now() >= cancelUnlockAt_(o),

        createdAt:
          o.createdAt ||
          o.created_at ||
          ''
      };
    });

  return {
    success: true,
    orders: items
  };
}

// Returns a privacy-safe activity feed for the signed-in app.  Do not expose
// phone numbers, usernames, provider order ids, or OTPs in this response.
function getRecentSales_(p) {
  requireAuth_(p);

  const excludedStatuses = ['cancelled', 'refunded', 'failed', 'expired'];
  const items = rows_('Orders')
    .filter(function(o) {
      return excludedStatuses.indexOf(String(o.status || '').toLowerCase()) === -1;
    })
    .sort(function(a, b) {
      return new Date(b.createdAt || b.created_at || 0).getTime() -
        new Date(a.createdAt || a.created_at || 0).getTime();
    })
    .slice(0, 10)
    .map(function(o) {
      return {
        service: o.service || o.service_name || 'OTP Service',
        country: o.country || o.country_name || '',
        price: money_(o.price !== undefined ? o.price : o.price_thb),
        createdAt: o.createdAt || o.created_at || ''
      };
    });

  return { success: true, sales: items };
}

// Public, aggregate-only figures used on the sign-in page. No account or
// order-level details are included in this response.
function getLoginStats_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('mailly_login_stats_v2');
  if (cached) {
    return JSON.parse(cached);
  }

  const orders = rows_('Orders');
  const properties = PropertiesService.getScriptProperties();
  const snapshotKey = 'MAILLY_LOGIN_ORDER_SNAPSHOT_V2';
  let snapshotCount = Number(properties.getProperty(snapshotKey));
  if (!Number.isFinite(snapshotCount) || snapshotCount < 0) {
    snapshotCount = orders.length;
    properties.setProperty(snapshotKey, String(snapshotCount));
  }
  const newOrderCount = Math.max(0, orders.length - snapshotCount);

  const result = {
    success: true,
    services: 1041,
    totalOrders: 96 + newOrderCount,
    activeMembers: 64,
    successRate30d: 99.4
  };

  cache.put('mailly_login_stats_v2', JSON.stringify(result), 240);
  return result;
}

function buyNumber_(p) {
  const u = requireAuth_(p);

  const service = String(
    p.serviceId || ''
  );

  const country = String(
    p.countryId || ''
  );

  if (
    !service ||
    !country
  ) {
    throw new Error(
      'กรุณาเลือกบริการและประเทศ'
    );
  }

  const countries = getCountries_({
    serviceId: service
  });
  const countryInfo = countries.find(function(item) {
    return String(item.country_id) === country;
  });

  if (!countryInfo) {
    throw new Error('ไม่พบประเทศที่เลือก');
  }

  // Fetch current choices again at the point of purchase. The browser may
  // request a provider id, but it can never set the price or bypass stock.
  const requestedProviderId = String(p.providerId || '');
  if (!requestedProviderId) {
    throw new Error('กรุณาเลือกตัวเลือกก่อนสั่งซื้อ');
  }

  const selectedOption = priceOptions_(service, country, true).find(function(option) {
    return String(option.provider_id) === requestedProviderId;
  });

  if (!selectedOption) {
    throw new Error('ตัวเลือกที่เลือกไม่มีหมายเลขว่างแล้ว กรุณาเลือกใหม่');
  }
  const sellPrice = priceFromThb_(selectedOption.price);

  if (
    money_(u.credit) <
    sellPrice
  ) {
    throw new Error(
      'เครดิตไม่เพียงพอ ต้องใช้ ' +
      sellPrice +
      ' บาท'
    );
  }

  const response = otpSms_(
    CONFIG.OTP_SMS.purchase,
    {
      country: country,
      service: service,
      provider_id: selectedOption.provider_id,
      max_price: selectedOption.price
    }
  );
  const provider = response.data || {};

  if (!provider.activation_id || !provider.phone_number) {
    throw new Error(
      'ยังไม่สามารถออกหมายเลขได้ กรุณาลองใหม่อีกครั้ง'
    );
  }

  const orderId =
    newId_('OTP');

  const newCredit =
    changeCredit_(
      u.username,
      -sellPrice
    );

  append_('Orders', {
    orderId: orderId,
    order_id: orderId,

    userId: u.username,
    username: u.username,

    smspoolOrderId:
      provider.activation_id,

    provider_order_id:
      provider.activation_id,

    provider: 'otp-sms',
    provider_id: selectedOption.provider_id,

    service:
      provider.service ||
      service,

    service_id: service,

    country:
      countryInfo.name ||
      country,

    country_id: country,

    phone:
      provider.phone_number,

    phonenumber:
      provider.phone_number,

    cc: '',

    price: sellPrice,
    price_thb: sellPrice,

    cost_usd:
      Number(provider.price) || Number(selectedOption.price),

    status: 'pending',
    sms: '',

    createdAt: now_(),
    created_at: now_(),
    updatedAt: now_(),

    cancel_unlock_at:
      new Date(
        Date.now() +
        CONFIG
          .CANCEL_UNLOCK_SECONDS *
        1000
      ),

    refunded_at: ''
  });

  return {
    success: true,
    order_id: orderId,
    cc: '',
    phonenumber:
      provider.phone_number,
    newCredit: newCredit
  };
}

function orderForUser_(
  username,
  orderId
) {
  user_(username, false);

  const o = rows_('Orders').find(
    function(r) {
      return (
        String(
          r.orderId ||
          r.order_id
        ) ===
          String(orderId) &&
        key_(
          r.userId ||
          r.username
        ) ===
          key_(username)
      );
    }
  );

  if (!o) {
    throw new Error(
      'ไม่พบคำสั่งซื้อ'
    );
  }

  return o;
}

function requireOtpSmsOrder_(order) {
  const activationId = String(
    order.smspoolOrderId ||
    order.provider_order_id ||
    ''
  );

  // Older rows were saved before the provider column existed and activation
  // ids can be numeric.  A non-empty stored activation id is sufficient.
  if (!activationId) {
    throw new Error(
      'รายการนี้ไม่สามารถจัดการต่อได้ กรุณาติดต่อแอดมิน'
    );
  }
}

function checkOtp_(p) {
  const u = requireAuth_(p);

  const o = rows_('Orders').find(
    function(r) {
      return (
        String(
          r.orderId ||
          r.order_id
        ) ===
          String(p.orderId) &&
        key_(
          r.userId ||
          r.username
        ) ===
          key_(u.username)
      );
    }
  );

  if (!o) {
    throw new Error(
      'ไม่พบคำสั่งซื้อ'
    );
  }

  requireOtpSmsOrder_(o);

  const synced = syncOtpSmsOrder_(o);

  return {
    success: true,
    status: synced.status,
    providerStatus: synced.provider_status || '',
    sms: synced.sms || ''
  };
}

function cancelOrder_(p) {
  const u = requireAuth_(p);

  const o = orderForUser_(
    u.username,
    p.orderId
  );
  requireOtpSmsOrder_(o);

  const remainingMs = cancelUnlockAt_(o) - Date.now();
  if (remainingMs > 0) {
    const minutes = Math.ceil(remainingMs / 60000);
    throw new Error('รายการนี้ยกเลิกได้หลังสั่งซื้อครบ 5 นาที (เหลือประมาณ ' + minutes + ' นาที)');
  }

  // Always check upstream before deciding whether an activation is eligible
  // for cancellation. A locally cached pending status must not block a valid
  // cancellation or refund when OTP-sms has already changed state.
  const synced = syncOtpSmsOrder_(o);

  if (
    [
      'completed',
      'refunded',
      'cancelled',
      'expired'
    ].indexOf(
      String(synced.status).toLowerCase()
    ) >= 0
  ) {
    throw new Error(
      'คำสั่งซื้อนี้ปิดไปแล้ว'
    );
  }

  otpSms_(
    CONFIG.OTP_SMS.setStatus,
    {
      activation_id:
        o.smspoolOrderId ||
        o.provider_order_id,
      action: 'cancel'
    }
  );
  const newCredit =
    changeCredit_(
      o.userId ||
      o.username,

      Number(
        o.price !== undefined
          ? o.price
          : o.price_thb
      )
    );

  updateRow_(
    'Orders',
    o._row,
    {
      status: 'refunded',
      refunded_at: now_(),
      updatedAt: now_()
    }
  );

  return {
    success: true,
    newCredit: newCredit
  };
}

function resendSms_(p) {
  const u = requireAuth_(p);

  const o = orderForUser_(
    u.username,
    p.orderId
  );
  requireOtpSmsOrder_(o);

  otpSms_(
    CONFIG.OTP_SMS.setStatus,
    {
      activation_id:
        o.smspoolOrderId ||
        o.provider_order_id,
      action: 'retry'
    }
  );

  updateRow_(
    'Orders',
    o._row,
    {
      status: 'waiting',
      sms: '',
      updatedAt: now_()
    }
  );

  return {
    success: true,
    message: 'ส่งคำขอ OTP รอบใหม่แล้ว'
  };
}

function buyKeepNumber_(p) {
  throw new Error(
      'บริการเช่าเบอร์ระยะยาวยังไม่พร้อมใช้งาน'
  );
}

/* =====================================================
   TOPUP
===================================================== */

function createTopup_(p) {
  const amount =
    money_(p.amount);

  if (
    amount <
    CONFIG.MIN_TOPUP
  ) {
    throw new Error(
      'เติมขั้นต่ำ ' +
      CONFIG.MIN_TOPUP +
      ' บาท'
    );
  }

  const u = requireAuth_(p);
  const image = p.imageObj || {};

  if (!image.base64) {
    throw new Error(
      'ไม่พบไฟล์สลิป'
    );
  }

  const folder =
    slipFolder_();

  const blob =
    Utilities.newBlob(
      Utilities.base64Decode(
        image.base64
      ),

      image.mimeType ||
        'image/jpeg',

      'slip-' +
      newId_('') +
      '.jpg'
    );

  const file =
    folder.createFile(blob);

  file.setSharing(
    DriveApp.Access
      .ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW
  );

  append_('Topups', {
    topup_id:
      newId_('TOP'),

    username:
      u.username,

    amount: amount,

    status:
      'รอแอดมินตรวจสอบ',

    slip_url:
      file.getUrl(),

    created_at:
      now_(),

    reviewed_at: '',
    note: ''
  });

  return {
    success: true,

    message:
      'ส่งสลิปเรียบร้อย รอแอดมินตรวจสอบและเติมเครดิต',

    newCredit:
      money_(u.credit),

    pending: true
  };
}

function slipFolder_() {
  if (
    CONFIG.SLIP_FOLDER_ID
  ) {
    return DriveApp.getFolderById(
      CONFIG.SLIP_FOLDER_ID
    );
  }

  const found =
    DriveApp.getFoldersByName(
      'Mailly OTP Slips'
    );

  return found.hasNext()
    ? found.next()
    : DriveApp.createFolder(
        'Mailly OTP Slips'
      );
}

function approveTopup(
  topupId,
  approve,
  note
) {
  const r = rows_('Topups').find(
    function(x) {
      return (
        String(x.topup_id) ===
        String(topupId)
      );
    }
  );

  if (!r) {
    throw new Error(
      'ไม่พบรายการเติมเงิน'
    );
  }

  if (
    String(r.status) !==
    'รอแอดมินตรวจสอบ'
  ) {
    throw new Error(
      'รายการนี้ถูกตรวจแล้ว'
    );
  }

  if (approve) {
    changeCredit_(
      r.username,
      Number(r.amount)
    );
  }

  updateRow_(
    'Topups',
    r._row,
    {
      status:
        approve
          ? 'อนุมัติแล้ว'
          : 'ปฏิเสธ',

      reviewed_at:
        now_(),

      note: note || ''
    }
  );

  return 'ดำเนินการเรียบร้อย';
}

/* =====================================================
   PRODUCTS
===================================================== */

function shopnoiApiKey_() {
  const key = PropertiesService
    .getScriptProperties()
    .getProperty('SHOPNOI_API_KEY');

  if (!key) {
    throw new Error(
      'ยังไม่ได้ตั้งค่า SHOPNOI_API_KEY ใน Script Properties'
    );
  }

  return String(key).trim();
}

function shopnoiRequest_(endpoint, params, method) {
  const values = Object.assign(
    {},
    params || {},
    { api_key: shopnoiApiKey_() }
  );

  const options = {
    method: String(method || 'get').toLowerCase(),
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      Accept: 'application/json'
    }
  };

  let url = CONFIG.SHOPNOI.base + endpoint;

  if (options.method === 'get') {
    const query = Object.keys(values)
      .filter(function(key) {
        return (
          values[key] !== undefined &&
          values[key] !== null &&
          String(values[key]) !== ''
        );
      })
      .map(function(key) {
        return (
          encodeURIComponent(key) +
          '=' +
          encodeURIComponent(String(values[key]))
        );
      })
      .join('&');

    url += '?' + query;
  } else {
    options.payload = values;
  }

  const response = UrlFetchApp.fetch(url, options);
  const httpStatus = response.getResponseCode();
  const text = response.getContentText();
  let body;

  try {
    body = JSON.parse(text || '{}');
  } catch (error) {
    throw new Error(
      'Shopnoi ส่งข้อมูลกลับมาในรูปแบบที่ไม่ถูกต้อง (HTTP ' +
      httpStatus +
      ')'
    );
  }

  body._httpStatus = httpStatus;
  return body;
}

function shopnoiSuccess_(body) {
  return (
    body &&
    String(body.status || '').toLowerCase() === 'success'
  );
}

function shopnoiError_(body, fallback) {
  return String(
    (body && (body.msg || body.message)) ||
    fallback ||
    'Shopnoi ไม่สามารถดำเนินการได้'
  );
}

function shopnoiProductById_(productId) {
  const response = shopnoiRequest_(
    CONFIG.SHOPNOI.product,
    { product: productId },
    'get'
  );

  if (!shopnoiSuccess_(response)) {
    throw new Error(
      shopnoiError_(response, 'ไม่พบสินค้า Shopnoi')
    );
  }

  const list = Array.isArray(response.product)
    ? response.product
    : response.product
      ? [response.product]
      : [];

  if (!list.length) {
    throw new Error('ไม่พบสินค้า Shopnoi');
  }

  return list[0];
}

function shopnoiProfile_() {
  const response = shopnoiRequest_(
    CONFIG.SHOPNOI.profile,
    {},
    'get'
  );

  if (!shopnoiSuccess_(response)) {
    throw new Error(
      shopnoiError_(response, 'โหลดข้อมูลบัญชี Shopnoi ไม่สำเร็จ')
    );
  }

  return response.data || {};
}

function getShopnoiCatalog_(p) {
  requireAuth_(p);

  let response;
  try {
    response = cachedJson_('mailly_store_catalog_v1', 120, function() {
      return shopnoiRequest_(
        CONFIG.SHOPNOI.products,
        {},
        'get'
      );
    }, p && (p.force === true || String(p.force) === 'true'));
  } catch (error) {
    console.warn('Store catalogue request failed: ' + safeError_(error));
    throw new Error('ไม่สามารถโหลดรายการสินค้าได้ในขณะนี้');
  }

  if (!shopnoiSuccess_(response)) {
    throw new Error(
      'ไม่สามารถโหลดรายการสินค้าได้ในขณะนี้'
    );
  }

  const categories = (Array.isArray(response.categories)
    ? response.categories
    : []).map(function(category) {
      return {
        id: String(category.id || category.category_id || ''),
        name: storeText_(category.name || category.category_name || 'อื่น ๆ'),
        products: (Array.isArray(category.products) ? category.products : []).map(storeProductView_)
      };
    });

  return {
    success: true,
    categories: categories,
    categoryCount: categories.length,
    productCount: categories.reduce(function(total, category) {
      return total + (
        Array.isArray(category.products)
          ? category.products.length
          : 0
      );
    }, 0),
    fetchedAt: new Date().toISOString()
  };
}

function storeText_(value) {
  return String(value || '').replace(/shopnoi/gi, 'MAILLY');
}

function storeProductView_(product) {
  product = product || {};
  return {
    id: String(product.id || product.product_id || ''),
    name: storeText_(product.name || product.product_name || ''),
    description: storeText_(product.description || product.detail || product.desc || ''),
    price: money_(product.price),
    amount: Math.max(0, Number(product.amount || product.stock) || 0),
    min: Math.max(1, Number(product.min || product.minimum) || 1),
    max: Math.max(0, Number(product.max || product.maximum) || 0),
    flag: storeText_(product.flag || product.badge || '')
  };
}

function getShopnoiProduct_(p) {
  requireAuth_(p);

  const productId = String(p.productId || '').trim();
  if (!/^\d+$/.test(productId)) {
    throw new Error('รหัสสินค้าไม่ถูกต้อง');
  }

  try {
    return {
      success: true,
      product: storeProductView_(shopnoiProductById_(productId))
    };
  } catch (error) {
    console.warn('Store product request failed: ' + safeError_(error));
    throw new Error('ไม่สามารถโหลดรายละเอียดสินค้าได้ในขณะนี้');
  }
}

function getShopnoiProfileForAdmin_(p) {
  requireAdmin_(p);
  const profile = shopnoiProfile_();

  return {
    success: true,
    profile: {
      username: profile.username || '',
      money: money_(profile.money)
    }
  };
}

function shopnoiPurchaseData_(value) {
  if (Array.isArray(value)) {
    return value.map(storeText_);
  }

  if (value === undefined || value === null || value === '') {
    return [];
  }

  return [
    typeof value === 'string'
      ? storeText_(value)
      : storeText_(JSON.stringify(value))
  ];
}

function parseStoredPurchaseData_(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) {
      return typeof item === 'string' ? storeText_(item) : item;
    });
  }

  const text = String(value || '');
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return (Array.isArray(parsed) ? parsed : [parsed]).map(function(item) {
      return typeof item === 'string' ? storeText_(item) : item;
    });
  } catch (error) {
    return [storeText_(text)];
  }
}

function ensureShopnoiPurchaseSchema_() {
  ensureSchemaHeaders_(
    sheet_('Purchases'),
    SCHEMAS.Purchases
  );
}

function buyShopnoiProduct_(p) {
  const u = requireAuth_(p);
  ensureShopnoiPurchaseSchema_();
  const productId = String(p.productId || '').trim();
  const quantity = Number(p.amount);
  const coupon = String(p.coupon || '').trim().slice(0, 100);

  if (!/^\d+$/.test(productId)) {
    throw new Error('รหัสสินค้าไม่ถูกต้อง');
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('จำนวนสินค้าต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ขึ้นไป');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('มีรายการอื่นกำลังดำเนินการ กรุณาลองใหม่อีกครั้ง');
  }

  let purchaseId = '';
  let reservedTotal = 0;
  let creditReserved = false;

  try {
    let product;
    try {
      product = shopnoiProductById_(productId);
    } catch (error) {
      console.warn('Store checkout product request failed: ' + safeError_(error));
      throw new Error('ไม่สามารถตรวจสอบสินค้าได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
    }
    const min = Math.max(1, Number(product.min) || 1);
    const maxByApi = Math.max(min, Number(product.max) || quantity);
    const available = Math.max(0, Number(product.amount) || 0);
    const max = Math.min(maxByApi, available);

    if (quantity < min) {
      throw new Error('สินค้านี้สั่งขั้นต่ำ ' + min + ' ชิ้น');
    }

    if (available < quantity || quantity > max) {
      throw new Error('สต็อกไม่เพียงพอ เหลือ ' + available + ' ชิ้น');
    }

    const unitPrice = money_(product.price);
    if (unitPrice <= 0) {
      throw new Error('ราคาสินค้าไม่ถูกต้อง');
    }

    reservedTotal = money_(unitPrice * quantity);
    const freshUser = user_(u.username, true);

    if (money_(freshUser.credit) < reservedTotal) {
      throw new Error(
        'เครดิตไม่เพียงพอ ต้องใช้ ' + reservedTotal.toFixed(2) + ' บาท'
      );
    }

    purchaseId = newId_('MLY');
    const newCreditAfterReserve = changeCredit_(
      u.username,
      -reservedTotal
    );
    creditReserved = true;

    append_('Purchases', {
      purchase_id: purchaseId,
      username: u.username,
      product_id: productId,
      product_name: storeText_(product.name || ''),
      price: reservedTotal,
      item_data: '[]',
      created_at: now_(),
      quantity: quantity,
      provider: 'shopnoi',
      provider_order_id: '',
      status: 'processing',
      coupon: coupon,
      updated_at: now_(),
      error_message: ''
    });

    const purchaseRow = rows_('Purchases').find(function(row) {
      return String(row.purchase_id) === purchaseId;
    });

    let response;
    try {
      response = shopnoiRequest_(
        CONFIG.SHOPNOI.purchase,
        {
          action: 'buyProduct',
          id: productId,
          amount: quantity,
          coupon: coupon
        },
        'post'
      );
    } catch (requestError) {
      const refundedCredit = changeCredit_(u.username, reservedTotal);
      creditReserved = false;

      if (purchaseRow) {
        updateRow_('Purchases', purchaseRow._row, {
          status: 'failed_refunded',
          updated_at: now_(),
          error_message: safeError_(requestError)
        });
      }

      throw new Error(
        'ไม่สามารถดำเนินการสั่งซื้อได้ ระบบคืนเครดิตแล้ว (คงเหลือ ' +
        refundedCredit.toFixed(2) +
        ' บาท)'
      );
    }

    if (!shopnoiSuccess_(response)) {
      const reason = storeText_(shopnoiError_(response, 'สั่งซื้อไม่สำเร็จ'));
      const refundedCredit = changeCredit_(u.username, reservedTotal);
      creditReserved = false;

      if (purchaseRow) {
        updateRow_('Purchases', purchaseRow._row, {
          status: 'failed_refunded',
          updated_at: now_(),
          error_message: reason
        });
      }

      throw new Error(
        reason +
        ' — ระบบคืนเครดิตแล้ว (คงเหลือ ' +
        refundedCredit.toFixed(2) +
        ' บาท)'
      );
    }

    // Shopnoi has accepted and fulfilled the order. From this point onward,
    // never run the emergency full refund in finally, even if local history
    // persistence or coupon reconciliation later encounters an error.
    creditReserved = false;

    const providerOrderId = String(
      response.trans_id || response.order || response.order_id || ''
    );
    const deliveredItems = shopnoiPurchaseData_(response.data);
    const chargedTotal = reservedTotal;
    const finalCredit = newCreditAfterReserve;
    const discountRefund = 0;
    if (purchaseRow) {
      updateRow_('Purchases', purchaseRow._row, {
        price: chargedTotal,
        item_data: JSON.stringify(deliveredItems),
        provider_order_id: providerOrderId,
        status: 'completed',
        updated_at: now_(),
        error_message: ''
      });
    }

    return {
      success: true,
      purchaseId: purchaseId,
      orderId: purchaseId,
      productId: productId,
      productName: storeText_(product.name || ''),
      quantity: quantity,
      unitPrice: unitPrice,
      total: chargedTotal,
      discount: discountRefund,
      data: deliveredItems,
      newCredit: finalCredit,
      status: 'completed',
      purchase: {
        purchaseId: purchaseId,
        orderId: purchaseId,
        productId: productId,
        productName: storeText_(product.name || ''),
        quantity: quantity,
        total: chargedTotal,
        data: deliveredItems,
        status: 'completed',
        coupon: coupon,
        createdAt: now_(),
        updatedAt: now_(),
        errorMessage: ''
      }
    };
  } finally {
    if (creditReserved && reservedTotal > 0) {
      try {
        changeCredit_(u.username, reservedTotal);
      } catch (refundError) {
        console.error('Emergency Shopnoi credit refund failed: ' + safeError_(refundError));
      }
    }

    lock.releaseLock();
  }
}

function getMyShopnoiPurchases_(p) {
  const u = requireAuth_(p);
  ensureShopnoiPurchaseSchema_();

  const purchases = rows_('Purchases')
    .filter(function(row) {
      return (
        key_(row.username) === key_(u.username) &&
        key_(row.provider) === 'shopnoi'
      );
    })
    .sort(function(a, b) {
      return String(b.created_at).localeCompare(String(a.created_at));
    })
    .slice(0, 100)
    .map(function(row) {
      return {
        purchaseId: row.purchase_id,
        orderId: row.purchase_id,
        productId: row.product_id,
        productName: storeText_(row.product_name),
        quantity: Number(row.quantity) || 1,
        total: money_(row.price),
        data: parseStoredPurchaseData_(row.item_data),
        status: row.status || 'completed',
        coupon: row.coupon || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
        errorMessage: storeText_(row.error_message || '')
      };
    });

  return {
    success: true,
    purchases: purchases
  };
}

function getMyShopnoiOrder_(p) {
  const u = requireAuth_(p);
  ensureShopnoiPurchaseSchema_();
  const orderId = String(p.orderId || '').trim();

  if (!orderId) {
    throw new Error('ไม่พบรหัสคำสั่งซื้อ');
  }

  const purchase = rows_('Purchases').find(function(row) {
    return (
      key_(row.username) === key_(u.username) &&
      key_(row.provider) === 'shopnoi' &&
      String(row.provider_order_id || row.purchase_id) === orderId
    );
  });

  if (!purchase) {
    throw new Error('ไม่พบคำสั่งซื้อของบัญชีนี้');
  }

  if (!purchase.provider_order_id) {
    return {
      success: true,
      order: {
        orderId: purchase.purchase_id,
        status: purchase.status || 'processing',
        data: parseStoredPurchaseData_(purchase.item_data),
        message: purchase.error_message || ''
      }
    };
  }

  const response = shopnoiRequest_(
    CONFIG.SHOPNOI.order,
    { order: purchase.provider_order_id },
    'get'
  );

  if (!shopnoiSuccess_(response)) {
    throw new Error(
      shopnoiError_(response, 'ตรวจสอบคำสั่งซื้อไม่สำเร็จ')
    );
  }

  return {
    success: true,
    order: response.order || response.data || response
  };
}

function buyProduct_(p) {
  const u = requireAuth_(p);

  if (
    p.username &&
    key_(p.username) !==
      key_(u.username)
  ) {
    throw new Error(
      'บัญชีผู้ซื้อไม่ตรงกับ Session'
    );
  }

  const product =
    rows_('Products').find(
      function(x) {
        return (
          String(
            x.product_id
          ) ===
            String(
              p.productId
            ) &&
          String(
            x.active
          ).toLowerCase() !==
            'false'
        );
      }
    );

  if (product) {
    const stock =
      rows_('ProductStock').find(
        function(x) {
          return (
            String(
              x.product_id
            ) ===
              String(
                p.productId
              ) &&
            String(
              x.sold
            ).toLowerCase() !==
              'true'
          );
        }
      );

    if (!stock) {
      throw new Error(
        'สินค้าหมดสต็อก'
      );
    }

    if (
      money_(u.credit) <
      Number(product.price)
    ) {
      throw new Error(
        'เครดิตไม่เพียงพอ'
      );
    }

    const newCredit =
      changeCredit_(
        u.username,
        -Number(
          product.price
        )
      );

    updateRow_(
      'ProductStock',
      stock._row,
      {
        sold: true,
        sold_at: now_()
      }
    );

    const id =
      newId_('BUY');

    append_('Purchases', {
      purchase_id: id,
      username: u.username,
      product_id:
        product.product_id,
      product_name:
        product.name,
      price:
        product.price,
      item_data:
        stock.item_data,
      created_at: now_()
    });

    return {
      success: true,
      orderId: id,
      itemData:
        stock.item_data,
      newCredit: newCredit
    };
  }

  const price =
    money_(p.price);

  if (
    price <= 0 ||
    money_(u.credit) < price
  ) {
    throw new Error(
      'เครดิตไม่เพียงพอหรือราคาไม่ถูกต้อง'
    );
  }

  const newCredit =
    changeCredit_(
      u.username,
      -price
    );

  const id =
    newId_('BUY');

  append_('Purchases', {
    purchase_id: id,
    username: u.username,

    product_id:
      p.productId ||
      'CUSTOM',

    product_name:
      p.productName || '',

    price: price,

    item_data:
      p.itemData || '',

    created_at: now_()
  });

  return {
    success: true,
    orderId: id,
    newCredit: newCredit
  };
}

/* =====================================================
   YOUTUBE FAMILY / INBOX
===================================================== */

function getYtUserData_(p) {
  const u = requireAuth_(p);

  return rows_('YTData')
    .filter(function(r) {
      return (
        key_(r.username) ===
        key_(u.username)
      );
    })
    .map(function(r) {
      return {
        username:
          r.username,

        familyId:
          r.family_id,

        email:
          r.email,

        status:
          r.status,

        expireDate:
          r.expire_date,

        slipUrl:
          r.slip_url
      };
    });
}

function requireAdmin_(p) {
  const u = requireAuth_(p);

  if (key_(u.username) !== key_(CONFIG.ADMIN_USERNAME)) {
    throw new Error('ไม่มีสิทธิ์สำหรับการดำเนินการนี้');
  }

  return u;
}

function getAllYtDataForAdmin_(p) {
  requireAdmin_(p);

  return rows_('YTData').map(
    function(r) {
      return {
        rowNumber: r._row,
        username:
          r.username,
        familyId:
          r.family_id,
        email:
          r.email,
        status:
          r.status,
        expireDate:
          r.expire_date,
        slipUrl:
          r.slip_url
      };
    }
  );
}

function updateYtUserDataFromAdmin_(p) {
  requireAdmin_(p);

  if (
    String(
      p.rowNumber
    ).indexOf('.') >= 0
  ) {
    throw new Error(
      'rowNumber ไม่ถูกต้อง'
    );
  }

  updateRow_(
    'YTData',
    Number(p.rowNumber),
    {
      status:
        p.newStatus || '',

      expire_date:
        p.newExpireDate || '',

      updated_at:
        now_()
    }
  );

  return 'success';
}

function processYtPayment_(p) {
  const u = requireAuth_(p);

  if (key_(p.username) !== key_(u.username)) {
    throw new Error('บัญชีผู้ชำระเงินไม่ตรงกับ Session');
  }

  const image =
    p.base64Data;

  if (!image) {
    throw new Error(
      'ไม่พบสลิป'
    );
  }

  const folder =
    slipFolder_();

  const blob =
    Utilities.newBlob(
      Utilities.base64Decode(
        image
      ),
      'image/jpeg',
      'yt-' +
      newId_('') +
      '.jpg'
    );

  const file =
    folder.createFile(blob);

  file.setSharing(
    DriveApp.Access
      .ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW
  );

  const row =
    rows_('YTData').find(
      function(r) {
        return (
          key_(r.username) ===
            key_(p.username) &&
          key_(r.email) ===
            key_(p.email)
        );
      }
    );

  if (row) {
    updateRow_(
      'YTData',
      row._row,
      {
        status:
          'รอแอดมินตรวจสอบ',

        slip_url:
          file.getUrl(),

        updated_at:
          now_()
      }
    );
  } else {
    append_('YTData', {
      username:
        p.username,

      family_id: '',

      email:
        p.email,

      status:
        'รอแอดมินตรวจสอบ',

      expire_date: '',

      slip_url:
        file.getUrl(),

      updated_at:
        now_()
    });
  }

  return 'success';
}

function getInbox_(p) {
  const u = requireAuth_(p);

  return {
    messages:
      rows_('Inbox')
        .filter(function(r) {
          return (
            key_(r.username) ===
            key_(u.username)
          );
        })
        .map(function(r) {
          return {
            message:
              r.message,

            date:
              r.created_at
          };
        })
  };
}

function sendInbox_(p) {
  requireAdmin_(p);

  const target = String(p.username || '').trim();
  if (!target) throw new Error('กรุณาระบุชื่อผู้ใช้');
  user_(target, false);

  append_('Inbox', {
    message_id:
      newId_('MSG'),

    username:
      target,

    message:
      String(
        p.message || ''
      ).slice(0, 2000),

    created_at:
      now_()
  });

  return {
    success: true
  };
}

function requestBackupEmail_(p) {
  const u = requireAuth_(p);

  if (key_(p.username) !== key_(u.username)) {
    throw new Error('บัญชีผู้ใช้ไม่ตรงกับ Session');
  }

  append_('Inbox', {
    message_id:
      newId_('REQ'),

    username:
      CONFIG.ADMIN_USERNAME,

    message:
      'คำขอเมลสำรองจาก ' +
      u.username +
      ' | email: ' +
      p.email +
      ' | family: ' +
      p.familyId,

    created_at:
      now_()
  });

  return {
    success: true
  };
}
