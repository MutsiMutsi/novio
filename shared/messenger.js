// messenger.js - Include in all components

class Messenger {
  constructor(componentType) {
    this.componentType = componentType;
    this.pendingMessages = new Map();
    
    // Listen for messages
    if (componentType === 'content') {
      // Content script listens for messages from background
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sendResponse);
        return true; // Keep sendResponse alive for async responses
      });
    } else {
      // All other components use runtime.onMessage
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sendResponse);
        return true;
      });
    }
  }

  // Send a message and return a promise
  async send(target, data) {
    const message = {
      id: this.generateId(),
      source: this.componentType,
      target: target,
      data: data,
      timestamp: Date.now()
    };

    console.log(`[${this.componentType}] Sending to ${target}:`, data);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(message.id);
        reject(new Error(`Message timeout: ${this.componentType} -> ${target}`));
      }, 5000);

      this.pendingMessages.set(message.id, { resolve, reject, timeout });

      // Send based on component type
      if (this.componentType === 'content') {
        chrome.runtime.sendMessage(message);
      } else if (this.componentType === 'background') {
        this.routeMessage(message);
      } else {
        chrome.runtime.sendMessage(message);
      }
    });
  }

  // Handle incoming messages
  handleMessage(message, sendResponse) {
    // Handle response to our sent message
    if (message.isResponse && this.pendingMessages.has(message.responseId)) {
      const pending = this.pendingMessages.get(message.responseId);
      clearTimeout(pending.timeout);
      this.pendingMessages.delete(message.responseId);
      
      if (message.error) {
        pending.reject(new Error(message.error));
      } else {
        pending.resolve(message.data);
      }
      return;
    }

    // Handle new message
    if (message.target === this.componentType) {
      console.log(`[${this.componentType}] Received from ${message.source}:`, message.data);
      
      // Emit event for local handling
      this.emit('message', {
        source: message.source,
        data: message.data,
        reply: (responseData, error = null) => {
          sendResponse({
            isResponse: true,
            responseId: message.id,
            data: responseData,
            error: error
          });
        }
      });
    }
  }

  // Route messages (background only)
  routeMessage(message) {
    if (this.componentType !== 'background') return;

    switch (message.target) {
      case 'content':
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, message);
          }
        });
        break;
      case 'popup':
      case 'offscreen':
        chrome.runtime.sendMessage(message);
        break;
      case 'background':
        // Handle locally
        this.handleMessage(message, (response) => {
          // Send response back to source - fix the routing
          if (message.source === 'content') {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
              if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, response);
              }
            });
          } else {
            chrome.runtime.sendMessage(response);
          }
        });
        break;
    }
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  // Simple event emitter
  emit(event, data) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  on(event, callback) {
    if (!this.listeners) this.listeners = {};
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }
}

// Usage examples:
/*
// In background.js:
const messenger = new ExtensionMessenger('background');
messenger.on('message', ({source, data, reply}) => {
  if (data.action === 'getData') {
    reply({result: 'some data from background'});
  }
});

// In content script:
const messenger = new ExtensionMessenger('content');
messenger.on('message', ({source, data, reply}) => {
  if (data.action === 'getDOMInfo') {
    reply({title: document.title});
  }
});

*/// Sending messages (from any component):
// messenger.send('background', {action: 'getData'})
//   .then(response => console.log(response))
//   .catch(error => console.error(error));

// messenger.send('content', {action: 'getDOMInfo'})
//   .then(response => console.log(response));

// messenger.send('offscreen', {action: 'processData', payload: data})
//   .then(response => console.log(response));