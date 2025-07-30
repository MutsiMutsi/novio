(function () {
    if (window.novio) return;

    class NovioProvider {
        constructor() {
            this.isConnected = false;
            this.isInstalled = true;
            this.pubkey = null;
            this.address = null;
        }

        sendSignatureRequest(message) {
            const signRequestEvent = new CustomEvent("onNovioSignRequest", {
                bubbles: true,
                cancelable: false,
                detail: {
                    data: message,
                    allowClient: true,
                },
            });
            document.dispatchEvent(signRequestEvent);

            window.postMessage({
                type: 'onNovioSignRequest',
                payload: {
                    data: message,
                    allowClient: true,
                }
            }, '*');

            return new Promise((resolve, reject) => {
                window.addEventListener("onNovioSignResponse", (event) => {
                    if (event.detail.data.error) {
                        reject(event.detail.data.error);
                    } else {
                        resolve(event.detail);
                    }
                }, false);
            })
        }

        sendSignOutRequest() {
            
            window.postMessage({
                type: 'onNovioSignOutRequest',
            }, '*');

            return new Promise((resolve, reject) => {
                window.addEventListener("onNovioSignOutResponse", (event) => {
                    if (event.detail.data.error) {
                        reject(event.detail.data.error);
                    } else {
                        resolve(event.detail);
                    }
                }, false);
            })
        }

        // Utility functions (keep these lightweight in provider)
        hexToBytes(hex) {
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
                bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
            }
            return bytes;
        }

        async messageToSignable(message) {
            const prefixedMsg = `NKN Signed Message:\n${message}`;
            const encoder = new TextEncoder();
            const encodedMsg = encoder.encode(prefixedMsg);
            const hashedOnce = await crypto.subtle.digest('SHA-256', encodedMsg);
            const hashedTwice = await crypto.subtle.digest('SHA-256', hashedOnce);
            return new Uint8Array(hashedTwice);
        }

        async verifyMessage(message, signature, publicKey) {
            try {
                const challenge = await this.messageToSignable(message);
                const signatureBytes = this.hexToBytes(signature);
                const publicKeyBytes = this.hexToBytes(publicKey);

                const cryptoKey = await crypto.subtle.importKey(
                    'raw',
                    publicKeyBytes,
                    { name: 'Ed25519', namedCurve: 'Ed25519' },
                    false,
                    ['verify']
                );

                return await crypto.subtle.verify(
                    'Ed25519',
                    cryptoKey,
                    signatureBytes,
                    challenge
                );
            } catch (error) {
                console.error('Verification error:', error);
                return false;
            }
        }

        async novioSignIn() {
            const randomChallenge = crypto.randomUUID();
            const result = await this.sendSignatureRequest(randomChallenge);
            this.pubkey = result.data.publicKey;
            this.address = result.data.address;
            const isValid = await this.verifyMessage(randomChallenge, result.data.signature, result.data.publicKey);
            return { isValid, pubkey: this.pubkey };
        }

        async novioSignOut() {
            const result = await this.sendSignOutRequest();
            return { result };
        }
    }

    // Create the provider instance
    window.novio = new NovioProvider();
})();