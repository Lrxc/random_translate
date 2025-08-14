/**
 * 中文词组翻译器 - 后台服务脚本
 */

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
    console.log('中文词组翻译器已安装');

    // 设置默认配置
    chrome.storage.sync.set({
        targetLanguage: 'en', translationFormat: 'bracket'
    });

    // 初始化全局启用状态并设置图标
    chrome.storage.local.get({globalEnabled: true}, ({globalEnabled}) => {
        chrome.storage.local.set({globalEnabled});
        updateActionIconByEnabled(globalEnabled);
    });
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'translation_completed') {
        sendResponse({success: true});
    }
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        // 页面加载完成后，可以在这里执行一些初始化操作
        console.log(`页面加载完成: ${tab.url}`);
    }
});

// 监听扩展图标点击
chrome.action.onClicked.addListener((tab) => {
    // 如果设置了popup，这个事件不会触发
    // 这里可以添加一些默认行为
    console.log('扩展图标被点击');
});

/**
 * 根据启用状态更新扩展图标
 */
async function updateActionIconByEnabled(enabled) {
    const relativePath = enabled ? 'images/icon_on.png' : 'images/icon_off.png';

    const url = chrome.runtime.getURL(relativePath);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`fetch ${resp.status}`);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);

    //图片尺寸必须(16/48/128)
    let osc = new OffscreenCanvas(bitmap.width, bitmap.height);
    let ctx = osc.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    imageDataMap = ctx.getImageData(0, 0, osc.width, osc.height);

    chrome.action.setIcon({imageData: imageDataMap})
        .then(() => {
            console.log("Icon changed successfully");
        }).catch((error) => {
        console.error("Error changing icon:", error);
    });
}

/**
 * 从存储同步启用状态并刷新图标
 */
function syncAndUpdateIcon() {
    chrome.storage.local.get({globalEnabled: true}, ({globalEnabled}) => {
        updateActionIconByEnabled(globalEnabled);
    });
}

// 浏览器启动或 service worker 唤醒时同步一次图标
chrome.runtime.onStartup.addListener(() => {
    syncAndUpdateIcon();
});

// 监听启用状态变化，实时更新图标
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.globalEnabled) {
        updateActionIconByEnabled(changes.globalEnabled.newValue !== false);
    }
});

// 初始执行一次，确保图标与当前状态匹配
syncAndUpdateIcon();