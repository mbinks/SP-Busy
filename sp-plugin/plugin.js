/**
 * BusyBar Status Sync v1.0 - Super Productivity Plugin
 * 
 * Architecture:
 * - plugin.js = credential manager + BusyBar API proxy + rules engine (survives navigation)
 * - index.html (iframe) = UI only, communicates via window.parent.busybarBridge
 * 
 * SECURITY: busybarToken stored via PluginAPI.setSecret() (never synced/exported).
 * Non-secret config stored via PluginAPI.persistDataSynced().
 */

// ============================================================
// CONFIG & SECRETS
// ============================================================

let config = { busybarUrl: 'https://api.busy.app', rules: [], statusMap: {} };
let busybarToken = '';
let configReady = false;

async function loadConfig() {
  // Load non-secret config from synced storage
  try {
    const raw = await PluginAPI.loadSyncedData();
    if (raw && raw.length > 2) {
      const parsed = JSON.parse(raw);
      // Migration: if old config has token in synced data, move to secrets
      if (parsed.busybarToken || parsed._token) {
        const tok = parsed.busybarToken || parsed._token;
        await PluginAPI.setSecret('busybarToken', tok);
        busybarToken = tok;
        delete parsed.busybarToken;
        delete parsed._token;
        await PluginAPI.persistDataSynced(JSON.stringify(parsed));
        console.log('[BusyBar] Migrated token to secret storage');
      }
      config = parsed;
    }
  } catch (e) { console.log('[BusyBar] Config load error:', e); }
  if (!config.rules) config.rules = [];
  if (!config.statusMap) config.statusMap = {};

  // Load token from secret storage (local-only, never synced)
  try {
    const secret = await PluginAPI.getSecret('busybarToken');
    if (secret) busybarToken = secret;
  } catch (e) { console.log('[BusyBar] getSecret error:', e); }

  configReady = true;
  console.log('[BusyBar] Config ready:', config.rules.length, 'rules, token:', busybarToken ? 'set' : 'empty');
  return config;
}

async function saveConfig() {
  // Never include token in synced data
  const safe = { ...config };
  delete safe.busybarToken;
  delete safe._token;
  try {
    await PluginAPI.persistDataSynced(JSON.stringify(safe));
    console.log('[BusyBar] Config saved');
  } catch (e) { console.log('[BusyBar] Config save error:', e); }
}

async function saveToken(token) {
  busybarToken = token;
  try {
    await PluginAPI.setSecret('busybarToken', token);
    console.log('[BusyBar] Token saved to secrets');
  } catch (e) { console.log('[BusyBar] setSecret error:', e); }
}

// ============================================================
// BUSYBAR API
// ============================================================

async function busybarApi(method, path, body = null) {
  if (!busybarToken) return null;
  
  // Build full URL: base URL + path
  let fullPath = path;
  if (!fullPath.startsWith('/')) {
    fullPath = '/' + fullPath;
  }
  
  const url = config.busybarUrl.replace(/\/$/, '') + fullPath;
  
  const opts = { 
    method, 
    headers: { 
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + busybarToken,
    } 
  };
  if (body) opts.body = JSON.stringify(body);
  
  try { 
    console.log('[BusyBar] API call:', method, url);
    const r = await fetch(url, opts); 
    const responseText = await r.text();
    
    if (!r.ok) {
      console.log('[BusyBar] API error:', r.status, responseText);
      return null;
    }
    
    try {
      return responseText ? JSON.parse(responseText) : { ok: true };
    } catch (e) {
      console.log('[BusyBar] JSON parse error:', e);
      return { ok: true };
    }
  }
  catch (e) { 
    console.log('[BusyBar] API error:', e);
    return null; 
  }
}

/**
 * Update BusyBar status based on task state
 * Sets the smart home switch state to indicate busy/available status
 * @param {string} status - Status value to set (e.g., 'busy', 'available', 'custom')
 * @param {string} emoji - Optional emoji to display
 * @param {string} message - Optional status message
 */
async function updateBusyBarStatus(status, emoji = '', message = '') {
  if (!busybarToken) return;
  try {
    // Use smart home switch to indicate status
    // true = busy, false = available
    const isBusy = (status === 'busy' || status === 'offline');
    const payload = { on: isBusy };
    
    const result = await busybarApi('POST', '/busybar/smart_home/switch', payload);
    if (result) {
      console.log('[BusyBar] Status updated:', status, '(switch ' + (isBusy ? 'on' : 'off') + ')');
      return result;
    }
  } catch (e) { console.log('[BusyBar] Status update error:', e); }
}

// ============================================================
// IFRAME BRIDGE - exposed as window.busybarBridge for iframe access
// ============================================================

const busybarBridge = {
  // Get current config (without token - iframe gets masked version)
  getConfig: () => ({ ...config, hasToken: !!busybarToken }),
  
  // Get token (masked for display)
  getTokenMasked: () => busybarToken ? busybarToken.substring(0, 10) + '...' : '',
  
  // Save settings from iframe
  saveSettings: async (settings) => {
    if (settings.busybarUrl) config.busybarUrl = settings.busybarUrl.replace(/\/$/, '');
    if (settings.statusMap) config.statusMap = settings.statusMap || {};
    await saveConfig();
    if (settings.token) await saveToken(settings.token);
    return true;
  },
  
  // Save rules from iframe
  saveRules: async (rules) => {
    config.rules = rules;
    await saveConfig();
    return true;
  },
  
  // Test connection by getting account info
  testConnection: async () => {
    try {
      const result = await busybarApi('GET', '/busybar/account/info');
      return result ? { ok: true, account: result } : { ok: false };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },
  
  // Get current status from smart home switch
  getCurrentStatus: async () => {
    return await busybarApi('GET', '/busybar/smart_home/switch');
  },
  
  // Update status
  updateStatus: async (status, emoji, message) => {
    return await updateBusyBarStatus(status, emoji, message);
  },
  
  // Check if ready
  isReady: () => configReady,
};

// Expose to iframe
if (typeof window !== 'undefined') {
  window.busybarBridge = busybarBridge;
}

// ============================================================
// RULES ENGINE
// ============================================================

async function evaluateRules(trigger, context = {}) {
  for (const rule of config.rules) {
    if (!rule.enabled) continue;
    if (rule.trigger !== trigger) continue;
    let match = true;
    if (rule.conditions) {
      if (rule.conditions.projectId && context.projectId !== rule.conditions.projectId) match = false;
      if (rule.conditions.tagId && !(context.tagIds || []).includes(rule.conditions.tagId)) match = false;
      if (rule.conditions.titleContains && !(context.title || '').toLowerCase().includes(rule.conditions.titleContains.toLowerCase())) match = false;
    }
    if (match) {
      console.log(`[BusyBar] Rule fired: ${rule.name} (${trigger})`);
      await executeAction(rule.action, context);
    }
  }
}

/**
 * Execute an action (update BusyBar status)
 */
async function executeAction(action, context = {}) {
  if (!action || !busybarToken) return;
  
  try {
    const message = (action.message || '')
      .replace('{title}', context.title || '')
      .replace('{project}', context.projectTitle || '')
      .replace('{time}', context.timeSpentMin || '0');
    
    await updateBusyBarStatus(
      action.status || 'available',
      action.emoji || '',
      message || ''
    );
  } catch (e) { console.log('[BusyBar] Action error:', e); }
}

// ============================================================
// TIMER & IDLE
// ============================================================

let trackingStartTime = null, trackingTaskId = null, timerCheckInterval = null;
let idleCheckInterval = null, firedTimerRules = new Set(), firedIdleRules = new Set();
let lastTrackingStopTime = null, sessionTasksStarted = 0;

function startTimerChecks() {
  if (timerCheckInterval) clearInterval(timerCheckInterval);
  trackingStartTime = Date.now(); 
  firedTimerRules.clear();
  if (idleCheckInterval) { clearInterval(idleCheckInterval); idleCheckInterval = null; } 
  firedIdleRules.clear();
  
  timerCheckInterval = setInterval(async () => {
    if (!trackingStartTime) return;
    const elapsedMin = (Date.now() - trackingStartTime) / 60000;
    for (const rule of config.rules) {
      if (!rule.enabled || rule.trigger !== 'timer') continue;
      const threshold = rule.conditions?.minutes || 0;
      if (threshold > 0 && elapsedMin >= threshold && !firedTimerRules.has(rule.id)) {
        firedTimerRules.add(rule.id); 
        await executeAction(rule.action, { timeSpentMin: Math.round(elapsedMin).toString() });
      }
    }
  }, 15000);
}

function stopTimerChecks() {
  if (timerCheckInterval) { clearInterval(timerCheckInterval); timerCheckInterval = null; }
  trackingStartTime = null; 
  trackingTaskId = null; 
  firedTimerRules.clear();
  lastTrackingStopTime = Date.now(); 
  firedIdleRules.clear(); 
  startIdleChecks();
}

function startIdleChecks() {
  if (idleCheckInterval) clearInterval(idleCheckInterval);
  idleCheckInterval = setInterval(async () => {
    if (!lastTrackingStopTime) return;
    const idleMin = (Date.now() - lastTrackingStopTime) / 60000;
    for (const rule of config.rules) {
      if (!rule.enabled || rule.trigger !== 'idle') continue;
      const threshold = rule.conditions?.minutes || 0;
      if (threshold > 0 && idleMin >= threshold && !firedIdleRules.has(rule.id)) {
        firedIdleRules.add(rule.id); 
        await executeAction(rule.action, {});
      }
    }
  }, 30000);
}

function buildContext(task) {
  if (!task) return {};
  return { 
    taskId: task.id, 
    title: task.title || '', 
    projectId: task.projectId || null, 
    tagIds: task.tagIds || [], 
    parentId: task.parentId || null, 
    timeSpentMin: Math.round((task.timeSpent || 0) / 60000) 
  };
}

// ============================================================
// HOOKS (all non-blocking via setTimeout)
// ============================================================

PluginAPI.registerHook('currentTaskChange', (data) => { setTimeout(() => onCurrentTaskChange(data), 10); });
PluginAPI.registerHook('taskCreated', (data) => { setTimeout(() => onTaskCreated(data), 10); });
PluginAPI.registerHook('taskComplete', (data) => { setTimeout(() => onTaskComplete(data), 10); });
PluginAPI.registerHook('taskUpdate', (data) => { setTimeout(() => onTaskUpdate(data), 10); });
PluginAPI.registerHook('taskDelete', (data) => { setTimeout(() => onTaskDelete(data), 10); });
PluginAPI.registerHook('finishDay', (data) => { setTimeout(() => onFinishDay(data), 10); });
PluginAPI.registerHook('anyTaskUpdate', (data) => { setTimeout(() => {}, 10); });
PluginAPI.registerHook('persistedDataChanged', () => { setTimeout(() => loadConfig(), 100); });

async function onCurrentTaskChange(data) {
  const currentTask = data?.current || null;
  const previousTask = data?.previous || null;
  console.log('[BusyBar] currentTaskChange:', currentTask?.id || 'null', '<-', previousTask?.id || 'null');

  if (currentTask) {
    sessionTasksStarted++;
    trackingTaskId = currentTask.id;
    const ctx = buildContext(currentTask);
    
    // Default: task started = busy status
    if (config.statusMap?.onTaskStart) {
      await executeAction(config.statusMap.onTaskStart, ctx);
    } else {
      await updateBusyBarStatus('busy', '🎯', `Working on: ${currentTask.title}`);
    }
    
    await evaluateRules('task_start', ctx);
    if (sessionTasksStarted === 1) await evaluateRules('first_task_of_day', ctx);
    if (previousTask) await evaluateRules('task_switch', ctx);
    startTimerChecks();
  } else {
    const ctx = previousTask ? buildContext(previousTask) : {};
    
    // Default: task stopped = available status
    if (config.statusMap?.onTaskStop) {
      await executeAction(config.statusMap.onTaskStop, ctx);
    } else {
      await updateBusyBarStatus('available', '✅', 'Back online');
    }
    
    stopTimerChecks();
    await evaluateRules('task_stop', ctx);
  }
}

async function onTaskCreated(data) { 
  await evaluateRules('task_created', buildContext(data?.task)); 
}

async function onTaskComplete(data) {
  const ctx = buildContext(data?.task || {});
  await evaluateRules('task_complete', ctx);
  
  // Check all done
  try {
    const tasks = await PluginAPI.getTasks();
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today).getTime();
    const endOfDay = startOfDay + 86400000;
    const todayTasks = tasks.filter(t => (t.dueWithTime && t.dueWithTime >= startOfDay && t.dueWithTime < endOfDay) || t.dueDay === today);
    if (todayTasks.length > 0 && todayTasks.every(t => t.isDone)) {
      await evaluateRules('all_done', { count: todayTasks.length });
      if (config.statusMap?.onAllDone) {
        await executeAction(config.statusMap.onAllDone, {});
      }
    }
  } catch(e) {}
}

async function onTaskUpdate(data) {
  const ctx = buildContext(data?.task || {});
  ctx.changes = data?.changes || {};
  await evaluateRules('task_updated', ctx);
  if (ctx.changes.tagIds) await evaluateRules('tags_changed', ctx);
  if (ctx.changes.projectId) await evaluateRules('project_changed', ctx);
}

async function onTaskDelete(data) { 
  await evaluateRules('task_deleted', { taskId: data?.taskId }); 
}

async function onFinishDay(data) {
  await evaluateRules('day_end', { date: data?.date });
  sessionTasksStarted = 0;
  
  if (config.statusMap?.onDayEnd) {
    await executeAction(config.statusMap.onDayEnd, {});
  }
}

// ============================================================
// INIT
// ============================================================

loadConfig().then(() => {
  console.log(`[BusyBar v1.0.1] Ready. ${config.rules.length} rules. Token: ${busybarToken ? 'set' : 'not set'}.`);
});
