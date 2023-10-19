const iframe = document.getElementById('sandboxFrame');

// Validate the password and password confirmation fields on every input
(async function () {
    'use strict';

    let isSet = await isMasterPasswordSet()
    if (isSet) {
        showAlreadyCreated();
        return;
    }

    // Fetch the password and password confirmation elements
    const password = document.getElementById('PasswordInput');
    const confirmPassword = document.getElementById('ConfirmPasswordInput');
    const termsCheckbox = document.getElementById("TermsCheckbox");
    const getStartedButton = document.getElementById("GetStartedButton");

    // Add event listeners to the password and password confirmation fields
    password.addEventListener('input', function () {
        validateState();
    });

    confirmPassword.addEventListener('input', function () {
        validateState();
    });

    termsCheckbox.addEventListener('change', (cb) => {
        validateState();
    });

    getStartedButton.addEventListener('click', async () => {
        isSet = await isMasterPasswordSet()
        if (!isSet) {

            //Migration from old wallet.
            const oldSeed = (await chrome.storage.local.get(['seed'])).seed;
            if (oldSeed != null) {
                //Trigger reload to make sure the sandbox libraries are loaded and available when popoup opens.
                iframe.src += '';
                iframe.onload = async function () {
                    //If create works, clear out local storage.
                    await createNewAccount('main', oldSeed, password.value);
                    await chrome.storage.local.clear();

                    //Now we have a blank slate, we know create works so we migrate.
                    await setMasterPassword(password.value);
                    await createNewAccount('main', oldSeed, password.value);
                    showAlreadyCreated();
                };
            } else {
                await setMasterPassword(password.value);
                showAlreadyCreated();
            }
        } else {
            alert('ERROR: master password is already set!');
            showAlreadyCreated();
        }
    });

    function showAlreadyCreated() {
        document.getElementById('CreatePasswordContainer').style.display = 'none';
        document.getElementById('PasswordCreatedContainer').style.display = 'block';
    }

    function validateState() {
        let isPasswordValid = false;

        if (password.value.length < 8) {
            password.classList.add('is-invalid');
            password.classList.remove('is-valid');
        } else {
            password.classList.add('is-valid');
            password.classList.remove('is-invalid');
        }

        if (confirmPassword.value.length < 8 || confirmPassword.value != password.value) {
            confirmPassword.classList.add('is-invalid');
            confirmPassword.classList.remove('is-valid');
        } else {
            confirmPassword.classList.add('is-valid');
            confirmPassword.classList.remove('is-invalid');
            isPasswordValid = true;
        }

        if (isPasswordValid && termsCheckbox.checked) {
            getStartedButton.disabled = false;
        } else {
            getStartedButton.disabled = true;
        }
    }
})();
