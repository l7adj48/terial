'use strict';
/* الثوابت والحالة العامة */
const PAD = 12, MARGIN = 30, MAX_HL = 400000;
const LEGACY_KEYS = ['CodePatcher_v16', 'CodePatcher_v15_final'];
const LS_KEY = 'CodePatcher_v17';

let S = { fs: 14, sym: 'auto', autoClose: true, kbReports: false, theme: 'dark', density: 'normal', radius: 'round', accent: 'default' };
let LH = 24;
let files = [], activeId = null, currentTab = 'p-edit', logs = [], lastPatchAttempt = null;
let saveTimer = null, lintTimer = null, idSeq = 0, removedIds = [], lastWarn = 0, legacyUsed = null;
let conMsgs = [], conOpen = false, errStore = [];
let baseH = 0, lastW = 0, symOn = false, _cw = 0, winFirst = 0, winLast = -1, selRaf = 0;
const fFlags = { case: false, regex: false };
const openTabs = new Set(), NLC = String.fromCharCode(10), BSL = String.fromCharCode(92);
let drawerOn = false, drawerV = 'files';
let selMode = false, lastRename = null; const selSet = new Set();
const psF = { case: false, regex: false };

const $ = id => document.getElementById(id);
