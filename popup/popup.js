/**
 * 中文词组翻译器 - 弹窗脚本（支持页面级开关）
 */

function withActiveTab(run) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const tab = tabs[0];
        if (tab && tab.id) {
            run(tab);
        }
    });
}

// 显示当前域名
function updateDomainDisplay(tab) {
    const domainElement = document.getElementById('currentDomain');
    if (tab && tab.url) {
        try {
            const url = new URL(tab.url);
            domainElement.textContent = `当前域名: ${url.hostname}`;
        } catch (e) {
            domainElement.textContent = `当前页面: ${tab.url.substring(0, 30)}...`;
        }
    } else {
        domainElement.textContent = '当前页面: 未知';
    }
}

// 更新状态显示
function updateStatus() {
    withActiveTab((tab) => {
        updateDomainDisplay(tab);
        chrome.tabs.sendMessage(tab.id, {type: 'get_status'}, (resp) => {
            const pageButton = document.getElementById('togglePageTranslation');
            const globalButton = document.getElementById('toggleGlobalTranslation');
            
            if (resp) {
                // 更新页面级按钮
                if (resp.enabled) {
                    pageButton.textContent = '当前页面：已启用';
                    pageButton.style.backgroundColor = '#4CAF50';
                    pageButton.style.color = 'white';
                } else {
                    pageButton.textContent = '当前页面：已关闭';
                    pageButton.style.backgroundColor = '#f44336';
                    pageButton.style.color = 'white';
                }
                
                // 更新全局按钮
                if (resp.globalEnabled) {
                    globalButton.textContent = '全局设置：已启用';
                    globalButton.style.backgroundColor = '#f0f8ff';
                    globalButton.style.color = '#333';
                } else {
                    globalButton.textContent = '全局设置：已关闭';
                    globalButton.style.backgroundColor = '#fff3cd';
                    globalButton.style.color = '#333';
                }
                
                // 显示页面级设置状态
                if (resp.hasPageSetting) {
                    pageButton.style.fontWeight = 'bold';
                } else {
                    pageButton.style.fontWeight = 'normal';
                }
            } else {
                // 如果无法获取状态，显示默认状态
                pageButton.textContent = '当前页面：未知';
                pageButton.style.backgroundColor = '#ccc';
                globalButton.textContent = '全局设置：未知';
                globalButton.style.backgroundColor = '#ccc';
            }
        });
    });
}

// 切换页面翻译功能
function togglePageTranslation() {
    withActiveTab((tab) => {
        chrome.tabs.sendMessage(tab.id, {type: 'toggle_translation'}, (resp) => {
            if (resp) {
                setTimeout(updateStatus, 100);
            }
        });
    });
}

// 切换全局翻译功能
function toggleGlobalTranslation() {
    withActiveTab((tab) => {
        chrome.tabs.sendMessage(tab.id, {type: 'toggle_global_translation'}, (resp) => {
            if (resp) {
                setTimeout(updateStatus, 100);
            }
        });
    });
}

function openOptions() {
    chrome.runtime.openOptionsPage();
}

function init() {
    updateStatus();
    document.getElementById('togglePageTranslation').addEventListener('click', togglePageTranslation);
    document.getElementById('toggleGlobalTranslation').addEventListener('click', toggleGlobalTranslation);
    document.getElementById('openOptions').addEventListener('click', openOptions);
}

document.addEventListener('DOMContentLoaded', init);