function videoswitch() {
    var video1 = document.getElementById("video1");
    var video2 = document.getElementById("video2");
    var checkboxElement = document.getElementsByClassName("toggle-checkbox")[0]; 
    if (!checkboxElement) {
        console.error("Checkbox element not found!");
        return;
    }
    
    if (checkboxElement.checked) {
        
        video1.classList.add('hidden');
        video2.classList.remove('hidden');
    } else {  
        video1.classList.remove('hidden');
        video2.classList.add('hidden');
    }
}

function toggleMode() {
    var checkbox = document.getElementById("dark-mode-toggle");
    if (checkbox.checked) {
        // Light mode
        document.documentElement.style.setProperty('--bg-color', '#ffffff');
        document.documentElement.style.setProperty('--text-color', '#3f3f3f');
        document.documentElement.style.setProperty('--nav-bg', '#333333');
        document.documentElement.style.setProperty('--nav-text', '#ffffff');
        document.documentElement.style.setProperty('--alt-bg', '#e3e3e3');
        document.documentElement.style.setProperty('--accent-color', '#3498db');
        document.documentElement.style.setProperty('--input-bg', '#ffffff');
        document.documentElement.style.setProperty('--input-border', '#ccc');
        document.documentElement.style.setProperty('--background', 'rgba(255, 255, 255, 0.048)');
        document.documentElement.style.setProperty('--border', '1px solid rgb(134, 134, 134)');
    } else {
        // Dark mode
        document.documentElement.style.setProperty('--bg-color', '#121212');
        document.documentElement.style.setProperty('--text-color', '#e0e0e0');
        document.documentElement.style.setProperty('--nav-bg', '#000000');
        document.documentElement.style.setProperty('--nav-text', '#e0e0e0');
        document.documentElement.style.setProperty('--alt-bg', '#1e1e1e');
        document.documentElement.style.setProperty('--accent-color', '#3498db');
        document.documentElement.style.setProperty('--input-bg', '#333333');
        document.documentElement.style.setProperty('--input-border', '#555');
        document.documentElement.style.setProperty('--background', 'rgba(255, 255, 255, 0.08)');
        document.documentElement.style.setProperty('--border', '1px solid rgba(255, 255, 255, 0.25)');
    }
}

function checkForm() {
    // Check name
    var nameInput = document.getElementById("name");
    var nameValue = nameInput.value;
    if (nameValue.length == 0) {
        alert("Please enter your name.");
        return false;
    }
    
    // Check email
    var emailInput = document.getElementById("email");
    var emailValue = emailInput.value;
    if (emailValue.length == 0) {
        alert("Please enter your email address.");
        return false;
    }
    if (emailValue.indexOf('@') === -1 || emailValue.indexOf('.') === -1) {
        alert("Please enter a valid email address.");
        return false;
    }
    
    return true;
}