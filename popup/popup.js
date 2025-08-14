/**
 * 中文词组翻译器 - 弹窗脚本（通过消息与内容脚本通信）
 */

function withActiveTab(run) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const tab = tabs[0];
        if (tab && tab.id) {
            run(tab);
        }
    });
}

// 更新状态显示
function updateStatus() {
    withActiveTab((tab) => {
        chrome.tabs.sendMessage(tab.id, {type: 'get_status'}, (resp) => {
            const status = document.getElementById('toggleTranslation');
            if (resp && resp.enabled) {
                status.textContent = '插件已启用';
                status.style.backgroundColor = '#f0f8ff';
            } else {
                status.textContent = '插件已关闭';
                status.style.backgroundColor = '#fff3cd';
            }
        });
    });
}

// 切换翻译功能
function toggleTranslation() {
    withActiveTab((tab) => {
        chrome.tabs.sendMessage(tab.id, {type: 'toggle_translation'}, (resp) => {
            const status = document.getElementById('toggleTranslation');
            if (resp && resp.enabled) {
                status.textContent = '插件已启用';
                status.style.backgroundColor = '#f0f8ff';
                // 同步持久化，确保后台可更新图标
                chrome.storage.local.set({globalEnabled: true});
            } else {
                status.textContent = '插件已关闭';
                status.style.backgroundColor = '#fff3cd';
                chrome.storage.local.set({globalEnabled: false});
            }
            // setTimeout(updateStatus, 1500);
        });
    });
}

function openOptions() {
    chrome.runtime.openOptionsPage();
}

function init() {
    updateStatus();
    document.getElementById('openOptions').addEventListener('click', openOptions);
    document.getElementById('toggleTranslation').addEventListener('click', toggleTranslation);
}

document.addEventListener('DOMContentLoaded', init);