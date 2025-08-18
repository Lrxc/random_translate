/**
 * 中文词组翻译器 - Chrome插件内容脚本
 * 功能：在页面加载完成后，先对中文分词，再逐词翻译并按用户选择的格式替换
 */

(function () {
    'use strict';

    // 配置（会在初始化时从 storage 覆盖）
    const config = {
        translateAPI: {
            google: 'https://translate.googleapis.com/translate_a/single'
        }, chineseBlockRegex: /[\u4e00-\u9fa5]+/g, // 连续中文块
        chineseWordMinLen: 2, // 中文词最小长度（2表示更偏向"词组"）
        translationCache: new Map(), targetLanguage: 'en', translationFormat: 'bracket', // 翻译格式：bracket, parenthesis, colon
        provider: 'google', // 有道云翻译配置
        youdaoUrl: '', youdaoAppKey: '', youdaoAppSecret: '', // 阿里云翻译配置
        aliyunUrl: '', aliyunAccessKeyId: '', aliyunAccessKeySecret: '', aliyunRegion: 'cn-hangzhou',
        translationRatio: 100, transCache: 1
    };

    // 在窗口作用域放一个开关，默认启用
    if (window.chineseTranslatorEnabled === undefined) {
        window.chineseTranslatorEnabled = true;
    }

    /**
     * 从同步存储读取用户配置
     */
    function loadUserConfig() {
        return new Promise((resolve) => {
            chrome.storage.sync.get({
                targetLanguage: 'en', translationFormat: 'bracket', provider: 'google', // 有道云翻译配置
                transMode: '1', transInterval: '1000',
                youdaoUrl: '', youdaoAppKey: '', youdaoAppSecret: '', // 阿里云翻译配置
                aliyunUrl: '', aliyunAccessKeyId: '', aliyunAccessKeySecret: '', aliyunRegion: 'cn-hangzhou',
                translationRatio: 100, transCache: 1
            }, (items) => {
                config.targetLanguage = items.targetLanguage || 'en';
                config.translationFormat = items.translationFormat || 'bracket';

                config.provider = items.provider || 'google';
                config.transMode = items.transMode || '';
                config.transInterval = items.transInterval || '';

                // 有道云翻译配置
                config.youdaoUrl = items.youdaoUrl || '';
                config.youdaoAppKey = items.youdaoAppKey || '';
                config.youdaoAppSecret = items.youdaoAppSecret || '';

                // 阿里云翻译配置
                config.aliyunUrl = items.aliyunUrl || '';
                config.aliyunAccessKeyId = items.aliyunAccessKeyId || '';
                config.aliyunAccessKeySecret = items.aliyunAccessKeySecret || '';
                config.aliyunRegion = items.aliyunRegion || 'cn-hangzhou';

                // 翻译比例
                config.translationRatio = items.translationRatio || 100;
                config.transCache = items.transCache || 1;

                resolve();
            });
        });
    }

    /**
     * 根据用户选择的格式生成替换文本
     * @param {string} token - 中文词组
     * @param {string} translation - 翻译结果
     * @returns {string} 格式化后的替换文本
     */
    function formatTranslation(token, translation) {
        switch (config.translationFormat) {
            case 'parenthesis':
                return `${token}(${translation})`;
            case 'colon':
                return `${token}:${translation}`;
            case 'bracket':
            default:
                return `${token}[${translation}]`;
        }
    }

    /**
     * 检测文本是否包含已处理的翻译标记
     */
    function containsTranslationMarkers(text) {
        switch (config.translationFormat) {
            case 'parenthesis':
                return text.includes('(') && text.includes(')');
            case 'colon':
                return text.includes(':');
            case 'bracket':
            default:
                return text.includes('[');
        }
    }

    /**
     * 确保注入一次用于高亮翻译文本的样式
     */
    let styleInjected = false;

    function ensureHighlightStyle() {
        if (styleInjected) return;
        const style = document.createElement('style');
        style.id = 'ce-translation-style';
        style.textContent = `.ce-translation{ color: green !important; }`;
        (document.head || document.documentElement).appendChild(style);
        styleInjected = true;
    }

    /**
     * 将包含格式化标记的纯文本，渲染为节点并对“英文部分”着色
     */
    function renderFormattedWithColor(textNode, combinedText) {
        ensureHighlightStyle();
        const parent = textNode.parentNode;
        if (!parent) return;

        let regex;
        if (config.translationFormat === 'bracket') {
            // 例：中文词组[translation]
            regex = /([\u4e00-\u9fa5]{2,})\[(.+?)\]/g;
        } else if (config.translationFormat === 'parenthesis') {
            // 例：中文词组(translation)
            regex = /([\u4e00-\u9fa5]{2,})\((.+?)\)/g;
        } else {
            // colon：中文词组:translation 或 中文词组:translation后接空白/标点
            // 尽量限制英文捕获到下一个分隔符
            regex = /([\u4e00-\u9fa5]{2,}):([^\u4e00-\u9fa5\n\r\t，。！？；：、\[\](){}<>]+?)(?=$|\s|[，。！？；：、\[\](){}<>])/g;
        }

        let lastIndex = 0;
        let match;
        const frag = document.createDocumentFragment();

        while ((match = regex.exec(combinedText)) !== null) {
            const start = match.index;
            const before = combinedText.slice(lastIndex, start);
            if (before) frag.appendChild(document.createTextNode(before));

            const cn = match[1];
            const en = match[2];

            if (config.translationFormat === 'bracket') {
                frag.appendChild(document.createTextNode(cn + '['));
                const span = document.createElement('span');
                span.className = 'ce-translation';
                span.textContent = en;
                frag.appendChild(span);
                frag.appendChild(document.createTextNode(']'));
            } else if (config.translationFormat === 'parenthesis') {
                frag.appendChild(document.createTextNode(cn + '('));
                const span = document.createElement('span');
                span.className = 'ce-translation';
                span.textContent = en;
                frag.appendChild(span);
                frag.appendChild(document.createTextNode(')'));
            } else {
                // colon
                frag.appendChild(document.createTextNode(cn + ':'));
                const span = document.createElement('span');
                span.className = 'ce-translation';
                span.textContent = en;
                frag.appendChild(span);
            }

            lastIndex = regex.lastIndex;
        }

        const tail = combinedText.slice(lastIndex);
        if (tail) frag.appendChild(document.createTextNode(tail));

        // 用容器包裹，标记已处理块，避免再次处理
        const wrapper = document.createElement('span');
        wrapper.className = 'ce-translated-chunk';
        wrapper.appendChild(frag);
        parent.replaceChild(wrapper, textNode);
    }

    /** 在遍历时跳过我们处理过的容器 */
    function isInsideTranslatedChunk(node) {
        try {
            if (node && node.parentElement && node.parentElement.closest) {
                return !!node.parentElement.closest('.ce-translated-chunk');
            }
        } catch (_) {
        }
        return false;
    }

    /**
     * 中文分词：优先使用 Intl.Segmenter('zh', { granularity: 'word' })
     * 失败则降级为按字符切分（尽量保证可用）
     */
    function segmentChinese(text) {
        try {
            if ('Segmenter' in Intl) {
                const segmenter = new Intl.Segmenter('zh', {granularity: 'word'});
                const tokens = [];
                for (const {segment, isWordLike} of segmenter.segment(text)) {
                    if (isWordLike && /[\u4e00-\u9fa5]/.test(segment)) {
                        tokens.push(segment);
                    }
                }
                if (tokens.length > 0) return tokens;
            }
        } catch (e) {
            // 忽略，走降级
        }
        // 降级：按单字符切分（尽力而为）。
        return text.split('');
    }

    /**
     * 检测文本是否包含中文
     */
    function containsChinese(text) {
        return /[\u4e00-\u9fa5]/.test(text);
    }

    /**
     * 使用 Google 翻译 API 翻译文本（zh -> targetLanguage）
     */
    async function translateWithGoogle(text, targetLang) {
        const url = `${config.translateAPI.google}?client=gtx&sl=zh&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data[0] && data[0][0]) {
            return data[0][0][0];
        }
        throw new Error('翻译结果格式错误');
    }

    // 有道云翻译 md5 签名
    async function translateWithYoudao(text, targetLang) {
        if (!config.youdaoAppKey || !config.youdaoAppSecret) {
            throw new Error('缺少有道 AppKey 或 AppSecret');
        }
        const appKey = config.youdaoAppKey;
        const key = config.youdaoAppSecret;
        const from = 'zh-CHS';
        const to = targetLang || 'en';
        const salt = String(Date.now());
        const curtime = String(Math.floor(Date.now() / 1000));
        const q = text;

        // 有道 v3 签名：sha256(appKey + truncate(q) + salt + curtime + key)
        function truncate(q) {
            const len = q.length;
            if (len <= 20) return q;
            return q.substring(0, 10) + len + q.substring(len - 10, len);
        }

        async function sha256Hex(str) {
            const enc = new TextEncoder();
            const data = enc.encode(str);
            const digest = await crypto.subtle.digest('SHA-256', data);
            const bytes = Array.from(new Uint8Array(digest));
            return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        const signStr = appKey + truncate(q) + salt + curtime + key;
        const sign = await sha256Hex(signStr);

        const form = new URLSearchParams();
        form.set('q', q);
        form.set('from', from);
        form.set('to', to);
        form.set('appKey', appKey);
        form.set('salt', salt);
        form.set('sign', sign);
        form.set('signType', 'v3');
        form.set('curtime', curtime);

        const resp = await fetch(config.youdaoUrl, {
            method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: form.toString()
        });
        const data = await resp.json();
        if (data && data.translation && data.translation[0]) {
            return data.translation[0];
        }
        throw new Error('有道翻译失败');
    }

    async function translateWithAliyun(text, targetLang) {
        if (!config.aliyunUrl || !config.aliyunAccessKeyId || !config.aliyunAccessKeySecret) {
            throw new Error('缺少阿里云配置');
        }
        // 这里以通用的简化签名示例为占位（不同阿里云接口签名流程不同，需按所选API文档调整）
        // 为演示目的，采用简单的 HMAC-SHA1 占位签名；若接口要求更复杂的签名，请替换。
        async function hmacSha1Base64(key, str) {
            const enc = new TextEncoder();
            const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), {name: 'HMAC', hash: 'SHA-1'}, false, ['sign']);
            const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(str));
            const bytes = new Uint8Array(sig);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            return btoa(binary);
        }

        const params = new URLSearchParams();
        params.set('Format', 'JSON');
        params.set('Version', '2018-10-12');
        params.set('Action', 'TranslateGeneral');
        params.set('RegionId', config.aliyunRegion || 'cn-hangzhou');
        params.set('SourceLanguage', 'zh');
        params.set('TargetLanguage', targetLang || 'en');
        params.set('SourceText', text);
        params.set('AccessKeyId', config.aliyunAccessKeyId);
        params.set('Timestamp', new Date().toISOString());
        params.set('SignatureMethod', 'HMAC-SHA1');
        params.set('SignatureVersion', '1.0');
        params.set('SignatureNonce', String(Date.now()));

        // 构造签名串（示意，实际需按阿里云签名规范 CanonicalizedQueryString 排序编码）
        const signStr = params.toString();
        const signature = await hmacSha1Base64(config.aliyunAccessKeySecret + '&', signStr);
        params.set('Signature', signature);

        const resp = await fetch(config.aliyunUrl, {
            method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: params.toString()
        });
        const data = await resp.json();
        if (data && (data.Data && data.Data.Translated || data.Translated)) {
            return (data.Data && data.Data.Translated) || data.Translated;
        }
        throw new Error('阿里云翻译失败');
    }

    let count = 1

    /**
     * 翻译中文词
     */
    async function translateToken(token) {
        if (config.transCache == 1 && config.translationCache.has(token)) {
            return config.translationCache.get(token);
        }

        //计算翻译比例
        if (100 / config.translationRatio > count) {
            count++
            return token
        }
        count = 1 //重置

        try {
            let translation;
            switch (config.provider) {
                case 'youdao':
                    try {
                        translation = await translateWithYoudao(token, config.targetLanguage);
                    } catch (error) {
                        console.warn('有道翻译失败:', error);
                    }
                    break;
                case 'aliyun':
                    try {
                        translation = await translateWithAliyun(token, config.targetLanguage);
                    } catch (error) {
                        console.warn('阿里云翻译失败:', error);
                    }
                    break;
                case 'google':
                default:
                    translation = await translateWithGoogle(token, config.targetLanguage);
                    break;
            }

            if (config.transCache == 1) {
                config.translationCache.set(token, translation);
                chrome.storage.local.set({[token]: translation});
            }

            return translation;
        } catch (error) {
            return token;
        }
    }

    /**
     * 将一段中文块分词并翻译，按用户选择的格式返回替换后的块
     */
    async function translateChineseBlock(blockText) {
        const tokens = segmentChinese(blockText)
            .filter(t => t && t.trim())
            .filter(t => t.length >= config.chineseWordMinLen);
        if (tokens.length === 0) return blockText;

        // 对 token 去重，避免重复请求
        const uniqueTokens = [...new Set(tokens)];
        // 优先替换更长的，避免较短 token 抢先替换
        uniqueTokens.sort((a, b) => b.length - a.length);

        // 顺序翻译每个token
        const translations = [];
        for (const token of uniqueTokens) {
            const translation = await translateToken(token);
            translations.push(translation);

            if (config.transMode == 1) {
                await sleep(config.transInterval)
            }
        }

        const tokenToTrans = new Map(uniqueTokens.map((t, i) => [t, translations[i]]));

        // 构造替换后的块
        let replaced = blockText;
        for (const token of uniqueTokens) {
            const trans = tokenToTrans.get(token);
            if (trans && trans !== token) {
                const safeToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const re = new RegExp(safeToken, 'g');
                const formattedTranslation = formatTranslation(token, trans);
                replaced = replaced.replace(re, formattedTranslation);
            }
        }
        return replaced;
    }

    /**
     * 处理文本节点
     */
    async function processTextNode(textNode) {
        if (window.chineseTranslatorEnabled === false) return;
        const original = textNode.textContent;
        if (!original || !original.trim()) return;
        // 已处理过的（包含我们使用的标记），跳过
        if (containsTranslationMarkers(original)) return;
        if (!containsChinese(original)) return;

        // 遍历中文块进行替换
        const parts = [];
        let lastIndex = 0;
        const regex = config.chineseBlockRegex;
        regex.lastIndex = 0;

        let match;
        while ((match = regex.exec(original)) !== null) {
            const start = match.index;
            const end = regex.lastIndex;
            if (start > lastIndex) {
                parts.push({type: 'plain', text: original.slice(lastIndex, start)});
            }
            const blockText = original.slice(start, end);
            // 顺序翻译每个中文块
            const translated = await translateChineseBlock(blockText);
            parts.push({type: 'cn', text: translated});
            lastIndex = end;
        }
        if (lastIndex < original.length) {
            parts.push({type: 'plain', text: original.slice(lastIndex)});
        }
        if (parts.length === 0) return;

        const combined = parts.map(p => p.text).join('');
        if (combined !== original) {
            renderFormattedWithColor(textNode, combined);
        }
    }

    async function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 递归处理 DOM
     */
    async function processTextNodes(node) {
        if (window.chineseTranslatorEnabled === false) return;
        if (!node) return;

        if (node.nodeType === Node.TEXT_NODE) {
            // 跳过我们已经渲染过的容器里的文本节点
            if (isInsideTranslatedChunk(node)) return;
            if (config.transMode == 1) {
                await processTextNode(node)
            } else {
                processTextNode(node)
            }
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName && node.tagName.toLowerCase();
            if (['script', 'style', 'noscript', 'input', 'textarea'].includes(tagName)) return;
            if (node.classList && node.classList.contains('ce-translated-chunk')) return;
            const childNodes = Array.from(node.childNodes);
            for (let child of childNodes) {
                if (config.transMode == 1) {
                    await processTextNodes(child)
                } else {
                    processTextNodes(child)
                }
            }
        }
    }

    /**
     * 主函数：处理页面文本
     */
    async function processPageText() {
        if (window.chineseTranslatorEnabled === false) return;
        try {
            await processTextNodes(document.body);
            console.log('中文分词并翻译：处理完成');
        } catch (error) {
            console.error('处理文本时出错:', error);
        }
    }

    /**
     * 监听 DOM 变化
     */
    function setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            if (window.chineseTranslatorEnabled === false) return;
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        processTextNodes(node);
                    }
                });
            });
        });
        observer.observe(document.body, {childList: true, subtree: true});
    }

    /**
     * 加载翻译缓存
     */
    function loadTranslationCache() {
        chrome.storage.local.get(null, (items) => {
            Object.entries(items).forEach(([key, value]) => {
                if (/[\u4e00-\u9fa5]/.test(key)) {
                    config.translationCache.set(key, value);
                }
            });
            console.log(`已加载 ${config.translationCache.size} 个翻译缓存`);
        });
    }

    /**
     * 清理翻译缓存
     */
    function clearTranslationCache() {
        config.translationCache.clear();
        // 清理本地存储中的翻译缓存
        chrome.storage.local.get(null, (items) => {
            const keysToRemove = [];
            Object.keys(items).forEach(key => {
                if (/[\u4e00-\u9fa5]/.test(key)) {
                    keysToRemove.push(key);
                }
            });
            if (keysToRemove.length > 0) {
                chrome.storage.local.remove(keysToRemove, () => {
                    console.log(`已清理 ${keysToRemove.length} 个翻译缓存`);
                });
            }
        });
    }

    /** 全局启用状态持久化（针对全部网页） */
    function syncEnabledFromStorage() {
        return new Promise((resolve) => {
            chrome.storage.local.get({globalEnabled: true}, ({globalEnabled}) => {
                window.chineseTranslatorEnabled = globalEnabled !== false;
                resolve(window.chineseTranslatorEnabled);
            });
        });
    }

    function persistEnabled(enabled) {
        chrome.storage.local.set({globalEnabled: !!enabled});
    }

    /**
     * 初始化
     */
    async function init() {
        loadTranslationCache();
        await loadUserConfig();
        // 先同步启用状态，避免刷新后状态丢失
        await syncEnabledFromStorage();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                processPageText();
                setupMutationObserver();
            });
        } else {
            processPageText();
            setupMutationObserver();
        }

        // 暴露给弹窗调用（不再依赖 executeScript 直接访问）
        window.processPageText = processPageText;
        window.loadUserConfig = loadUserConfig;

        // 监听配置变化
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                if (changes.targetLanguage || changes.translationFormat || changes.transMode || changes.transInterval || changes.translationRatio) {
                    if (changes.targetLanguage) {
                        clearTranslationCache();//清空翻译的缓存
                    }
                    console.log('检测到配置变化，重新加载配置...');
                    loadUserConfig().then(() => {
                        console.log('配置已重新加载');
                    });
                }

            } else if (namespace === 'local' && changes.globalEnabled) {
                // 全局开关变化时，同步内存开关
                window.chineseTranslatorEnabled = changes.globalEnabled.newValue !== false;
            }
        });

        // 监听来自popup的消息（暂停/恢复、刷新、状态查询）
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (!message || !message.type) return;
            if (message.type === 'toggle_translation') {
                if (window.chineseTranslatorEnabled === undefined) {
                    window.chineseTranslatorEnabled = true;
                }
                window.chineseTranslatorEnabled = !window.chineseTranslatorEnabled;
                persistEnabled(window.chineseTranslatorEnabled);
                processPageText();
                sendResponse({enabled: window.chineseTranslatorEnabled});
            } else if (message.type === 'refresh_translation') {
                processPageText();
                sendResponse({ok: true});
            } else if (message.type === 'get_status') {
                syncEnabledFromStorage().then((enabled) => {
                    sendResponse({enabled});
                });
                return true;
            } else if (message.type === 'refresh_config') {
                loadUserConfig().then(() => sendResponse({ok: true}));
                return true;
            } else if (message.type === 'tran_clean') {
                clearTranslationCache();//清空翻译的缓存
                return true;
            }
        });
    }

    init();
})(); 