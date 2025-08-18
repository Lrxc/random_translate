/**
 * 中文词组翻译器 - 设置页面脚本
 */

// 默认配置
const defaultConfig = {
    targetLanguage: 'en',
    translationFormat: 'bracket',
    provider: 'google',
    transMode: '1',
    transInterval: '1000',
    translationRatio: '100',
    transCache: '1',
    // 有道云翻译配置
    youdaoUrl: '',
    youdaoAppKey: '',
    youdaoAppSecret: '',
    // 阿里云翻译配置
    aliyunUrl: '',
    aliyunAccessKeyId: '',
    aliyunAccessKeySecret: '',
    aliyunRegion: 'cn-hangzhou'
};

// 显示状态消息
function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

// 加载配置
function loadConfig() {
    chrome.storage.sync.get(defaultConfig, (config) => {
        document.getElementById('targetLanguage').value = config.targetLanguage;
        document.getElementById('translationFormat').value = config.translationFormat;

        document.getElementById('provider').value = config.provider || 'google';
        document.getElementById('transMode').value = config.transMode
        document.getElementById('transInterval').value = config.transInterval
        document.getElementById('translationRatio').value = config.translationRatio;
        document.getElementById('transCache').value = config.transCache;

        // 有道云翻译配置
        document.getElementById('youdaoUrl').value = config.youdaoUrl || '';
        document.getElementById('youdaoAppKey').value = config.youdaoAppKey || '';
        document.getElementById('youdaoAppSecret').value = config.youdaoAppSecret || '';

        // 阿里云翻译配置
        document.getElementById('aliyunUrl').value = config.aliyunUrl || '';
        document.getElementById('aliyunAccessKeyId').value = config.aliyunAccessKeyId || '';
        document.getElementById('aliyunAccessKeySecret').value = config.aliyunAccessKeySecret || '';
        document.getElementById('aliyunRegion').value = config.aliyunRegion || 'cn-hangzhou';

        toggleProviderSection();
    });
}

function toggleProviderSection() {
    const provider = document.getElementById('provider').value;

    // 隐藏所有配置区域
    document.getElementById('youdao-config').style.display = 'none';
    document.getElementById('aliyun-config').style.display = 'none';

    // 根据选择的提供商显示对应配置
    if (provider === 'youdao') {
        document.getElementById('youdao-config').style.display = 'block';
    } else if (provider === 'aliyun') {
        document.getElementById('aliyun-config').style.display = 'block';
    }
}

// 保存配置
function saveConfig() {
    const config = {
        targetLanguage: document.getElementById('targetLanguage').value,
        translationFormat: document.getElementById('translationFormat').value,

        provider: document.getElementById('provider').value,
        transMode: document.getElementById('transMode').value,
        transInterval: document.getElementById('transInterval').value,
        translationRatio: document.getElementById('translationRatio').value,
        transCache: document.getElementById('transCache').value,

        // 有道云翻译配置
        youdaoUrl: document.getElementById('youdaoUrl').value.trim(),
        youdaoAppKey: document.getElementById('youdaoAppKey').value.trim(),
        youdaoAppSecret: document.getElementById('youdaoAppSecret').value.trim(),

        // 阿里云翻译配置
        aliyunUrl: document.getElementById('aliyunUrl').value.trim(),
        aliyunAccessKeyId: document.getElementById('aliyunAccessKeyId').value.trim(),
        aliyunAccessKeySecret: document.getElementById('aliyunAccessKeySecret').value.trim(),
        aliyunRegion: document.getElementById('aliyunRegion').value.trim()
    };

    chrome.storage.sync.set(config, () => {
        showStatus('配置已保存');
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.id) chrome.tabs.sendMessage(tab.id, {type: 'refresh_config'}, () => {
                });
            });
        });
    });
}

// 实时预览翻译格式
function updateFormatPreview() {
    const format = document.getElementById('translationFormat').value;
    const previewText = document.getElementById('formatPreview');

    let example = '';
    switch (format) {
        case 'parenthesis':
            example = '中文词组(Chinese phrase)';
            break;
        case 'colon':
            example = '中文词组: Chinese phrase';
            break;
        case 'bracket':
        default:
            example = '中文词组[Chinese phrase]';
            break;
    }

    if (previewText) {
        previewText.textContent = example;
    }
}

// 初始化页面
function init() {
    loadConfig();
    updateFormatPreview();

    document.getElementById('targetLanguage').addEventListener('change', saveConfig);
    document.getElementById('translationFormat').addEventListener('change', saveConfig);
    document.getElementById('translationFormat').addEventListener('change', updateFormatPreview);
    document.getElementById('transMode').addEventListener('change', saveConfig);
    document.getElementById('transInterval').addEventListener('change', saveConfig);
    document.getElementById('translationRatio').addEventListener('change', saveConfig);
    document.getElementById('transCache').addEventListener('change', saveConfig);

    document.getElementById('provider').addEventListener('change', () => {
        toggleProviderSection();
        saveConfig();
    });

    document.getElementById('tranClean').addEventListener("click",()=>{
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.id) chrome.tabs.sendMessage(tab.id, {type: 'tran_clean'}, () => {
                    showStatus('缓存已清理');
                });
            });
        });
    });

    // 有道云翻译配置字段监听
    ['youdaoUrl', 'youdaoAppKey', 'youdaoAppSecret']
        .forEach(id => document.getElementById(id).addEventListener('change', saveConfig));

    // 阿里云翻译配置字段监听
    ['aliyunUrl', 'aliyunAccessKeyId', 'aliyunAccessKeySecret', 'aliyunRegion']
        .forEach(id => document.getElementById(id).addEventListener('change', saveConfig));
}

document.addEventListener('DOMContentLoaded', init);