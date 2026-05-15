'use strict';

// 아이콘 클릭 시 사이드 패널 열기/닫기
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);
