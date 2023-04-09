var encodedContact = 'bXV0c2lkZXZAZ21haWwuY29t';
const form = document.getElementById("contact");
form.setAttribute("href", "mailto:".concat(atob(encodedContact)));