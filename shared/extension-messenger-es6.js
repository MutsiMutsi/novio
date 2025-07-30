// Universal Chrome Extension Messaging System
// Handles communication between all extension contexts

class ExtensionMessenger {
    constructor(contextType) {
        this.contextType = contextType;
        this.messageHandlers = new Map();
        this.responseHandlers = new Map();
        this.eventHandlers = new Map();
        this.messageId = 0;

        this.init();
    }

    init() {
        // Set up listeners based on context
        this.setupRuntimeMessageListener();
        this.setupWindowMessageListener();
        this.setupStorageListener();
    }

    // Generate unique message ID
    generateMessageId() {
        return `msg_${this.contextType}_${++this.messageId}_${Date.now()}`;
    }

    // Main send method - automatically determines best transport
    async send(targetContext, action, data = {}, options = {}) {
        const messageId = this.generateMessageId();
        const message = {
            id: messageId,
            from: this.contextType,
            to: targetContext,
            action,
            data,
            timestamp: Date.now(),
            expectResponse: options.expectResponse !== false
        };

        try {
            const transport = this.getTransport(this.contextType, targetContext);
            return await this.sendViaTransport(transport, message, options);
        } catch (error) {
            console.error(`Failed to send message from ${this.contextType} to ${targetContext}:`, error);
            throw error;
        }
    }

    // Broadcast to multiple contexts
    async broadcast(targetContexts, action, data = {}, options = {}) {
        const promises = targetContexts.map(context =>
            this.send(context, action, data, options).catch(err => ({ error: err, context }))
        );
        return Promise.all(promises);
    }

    // Register message handler
    on(action, handler) {
        if (!this.messageHandlers.has(action)) {
            this.messageHandlers.set(action, []);
        }
        this.messageHandlers.get(action).push(handler);
    }

    // Remove message handler
    off(action, handler) {
        if (this.messageHandlers.has(action)) {
            const handlers = this.messageHandlers.get(action);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    // Register event handler (for window/custom events)
    onEvent(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
    }

    // Determine best transport method between contexts
    getTransport(from, to) {
        const routes = {
            // Background script routes
            'background->popup': 'runtime',
            'background->content': 'runtime',
            'background->offscreen': 'runtime',
            'background->options': 'runtime',

            // Popup routes
            'popup->background': 'runtime',
            'popup->content': 'runtime_tabs',
            'popup->offscreen': 'runtime',

            // Content script routes
            'content->background': 'runtime',
            'content->popup': 'runtime',
            'content->offscreen': 'runtime',
            'content->page': 'window',

            // Offscreen routes
            'offscreen->background': 'runtime',
            'offscreen->popup': 'runtime',
            'offscreen->content': 'runtime',

            // Page script routes (sandboxed)
            'page->content': 'window',
            'page->offscreen': 'window',

            // Options page routes
            'options->background': 'runtime',
            'options->offscreen': 'runtime',

            // Special cases
            'content->content': 'storage', // Between different tabs
            'offscreen->page': 'window'
        };

        const route = `${from}->${to}`;
        return routes[route] || 'runtime'; // Default to runtime
    }

    // Send via specific transport
    async sendViaTransport(transport, message, options = {}) {
        const timeout = options.timeout || 5000;

        switch (transport) {
            case 'runtime':
                return this.sendViaRuntime(message, timeout);

            case 'runtime_tabs':
                return this.sendViaRuntimeTabs(message, timeout);

            case 'window':
                return this.sendViaWindow(message, timeout);

            case 'storage':
                return this.sendViaStorage(message, timeout);

            default:
                throw new Error(`Unknown transport: ${transport}`);
        }
    }

    // Chrome runtime messaging
    async sendViaRuntime(message, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Message timeout: ${message.action}`));
            }, timeout);

            try {
                chrome.runtime.sendMessage(message, (response) => {
                    clearTimeout(timeoutId);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    // Chrome tabs messaging
    async sendViaRuntimeTabs(message, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Message timeout: ${message.action}`));
            }, timeout);

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                        clearTimeout(timeoutId);
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                } else {
                    clearTimeout(timeoutId);
                    reject(new Error('No active tab found'));
                }
            });
        });
    }

    // Window postMessage (for page scripts)
    async sendViaWindow(message, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.responseHandlers.delete(message.id);
                reject(new Error(`Message timeout: ${message.action}`));
            }, timeout);

            // Store response handler
            this.responseHandlers.set(message.id, (response) => {
                clearTimeout(timeoutId);
                resolve(response);
            });

            // Send message
            const targetWindow = this.getTargetWindow(message.to);
            targetWindow.postMessage({
                type: 'EXTENSION_MESSAGE',
                payload: message
            }, '*');
        });
    }

    // Chrome storage messaging (for cross-tab communication)
    async sendViaStorage(message, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Message timeout: ${message.action}`));
            }, timeout);

            const storageKey = `msg_${message.id}`;
            const responseKey = `response_${message.id}`;

            // Listen for response
            const responseListener = (changes, area) => {
                if (area === 'local' && changes[responseKey]) {
                    clearTimeout(timeoutId);
                    chrome.storage.onChanged.removeListener(responseListener);
                    chrome.storage.local.remove([storageKey, responseKey]);
                    resolve(changes[responseKey].newValue);
                }
            };

            chrome.storage.onChanged.addListener(responseListener);

            // Send message via storage
            chrome.storage.local.set({ [storageKey]: message });
        });
    }

    // Get target window for postMessage
    getTargetWindow(targetContext) {
        switch (targetContext) {
            case 'page':
                return window;
            case 'offscreen':
                return window; // When in offscreen context
            default:
                return window;
        }
    }

    // Setup runtime message listener
    setupRuntimeMessageListener() {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleMessage(message, sender, sendResponse);
                return true; // Keep message channel open for async responses
            });
        }
    }

    // Setup window message listener
    setupWindowMessageListener() {
        if (typeof window !== 'undefined') {
            window.addEventListener('message', (event) => {
                if (event.data.type === 'EXTENSION_MESSAGE') {
                    this.handleMessage(event.data.payload, {}, (response) => {
                        // Send response back via postMessage
                        event.source.postMessage({
                            type: 'EXTENSION_RESPONSE',
                            messageId: event.data.payload.id,
                            payload: response
                        }, event.origin);
                    });
                } else if (event.data.type === 'EXTENSION_RESPONSE') {
                    // Handle response
                    const handler = this.responseHandlers.get(event.data.messageId);
                    if (handler) {
                        this.responseHandlers.delete(event.data.messageId);
                        handler(event.data.payload);
                    }
                }
            });
        }
    }

    // Setup storage listener (for cross-tab messaging)
    setupStorageListener() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local') {
                    Object.keys(changes).forEach(key => {
                        if (key.startsWith('msg_') && changes[key].newValue) {
                            const message = changes[key].newValue;
                            if (message.to === this.contextType) {
                                this.handleMessage(message, {}, (response) => {
                                    const responseKey = `response_${message.id}`;
                                    chrome.storage.local.set({ [responseKey]: response });
                                });
                            }
                        }
                    });
                }
            });
        }
    }

    // Handle incoming messages
    async handleMessage(message, sender, sendResponse) {
        // Ignore messages not meant for this context
        if (message.to && message.to !== this.contextType) {
            return;
        }

        const handlers = this.messageHandlers.get(message.action) || [];

        if (handlers.length === 0) {
            console.warn(`No handler for action: ${message.action} in ${this.contextType}`);
            if (sendResponse) sendResponse({ error: 'No handler found' });
            return;
        }

        try {
            // Execute all handlers and collect responses
            const responses = await Promise.all(
                handlers.map(handler => handler(message.data, message, sender))
            );

            // Send back the first non-undefined response or all responses
            const response = responses.length === 1 ? responses[0] : responses;
            if (sendResponse) sendResponse(response);
        } catch (error) {
            console.error(`Error handling message ${message.action}:`, error);
            if (sendResponse) sendResponse({ error: error.message });
        }
    }
}

// Context detection utility
function detectContext() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        if (chrome.runtime.getURL('').startsWith('chrome-extension://')) {
            if (location.pathname.includes('popup')) return 'popup';
            if (location.pathname.includes('options')) return 'options';
            if (location.pathname.includes('offscreen')) return 'offscreen';
            if (chrome.extension.getBackgroundPage) return 'background';
        }

        // Check if we're in a content script
        if (window === window.top && document.documentElement) {
            return 'content';
        }
    }

    // Default to page script
    return 'page';
}

// Factory function to create messenger
function createMessenger(contextType = null) {
    const context = contextType || detectContext();
    return new ExtensionMessenger(context);
}

export { ExtensionMessenger, createMessenger, detectContext };

// ES6 export (add this line for module support)

// Usage Examples:

/*
// In background script:
const messenger = createMessenger('background');

messenger.on('getUserData', async (data) => {
  const userData = await fetchUserData(data.userId);
  return userData;
});

// In popup:
const messenger = createMessenger('popup');

const userData = await messenger.send('background', 'getUserData', {userId: 123});

// In content script:
const messenger = createMessenger('content');

messenger.on('highlightText', (data) => {
  document.querySelector(data.selector).style.backgroundColor = 'yellow';
  return {success: true};
});

// Send to content script from popup:
await messenger.send('content', 'highlightText', {selector: '.important'});

// Broadcast to multiple contexts:
await messenger.broadcast(['background', 'content'], 'updateTheme', {theme: 'dark'});
*/