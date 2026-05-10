function videoswitch(){
    var video1=document.getElementById("video1");
    var video2=document.getElementById("video2");
    var checkboxElement=document.getElementsByClassName("toggle-checkbox")[0];
    if (!checkboxElement){
        console.error("Checkbox element not found!");
        return;
    }
    if (checkboxElement.checked){
        video1.classList.add('hidden');
        video2.classList.remove('hidden');
    }
    else {
        video1.classList.remove('hidden');
        video2.classList.add('hidden');
    }
}

function toggleMode(){
    var checkbox=document.getElementById("dark-mode-toggle");
    if (checkbox.checked){
        document.documentElement.style.setProperty('--bg-color','#ffffff');
        document.documentElement.style.setProperty('--text-color','#3f3f3f');
        document.documentElement.style.setProperty('--nav-bg','#333333');
        document.documentElement.style.setProperty('--nav-text','#ffffff');
        document.documentElement.style.setProperty('--alt-bg','#e3e3e3');
        document.documentElement.style.setProperty('--accent-color','#3498db');
        document.documentElement.style.setProperty('--input-bg','#ffffff');
        document.documentElement.style.setProperty('--input-border','#ccc');
        document.documentElement.style.setProperty('--background','rgba(255,255,255,0.048)');
        document.documentElement.style.setProperty('--border','1px solid rgb(134,134,134)');
    }
    else {
        document.documentElement.style.setProperty('--bg-color','#121212');
        document.documentElement.style.setProperty('--text-color','#e0e0e0');
        document.documentElement.style.setProperty('--nav-bg','#000000');
        document.documentElement.style.setProperty('--nav-text','#e0e0e0');
        document.documentElement.style.setProperty('--alt-bg','#1e1e1e');
        document.documentElement.style.setProperty('--accent-color','#3498db');
        document.documentElement.style.setProperty('--input-bg','#333333');
        document.documentElement.style.setProperty('--input-border','#555');
        document.documentElement.style.setProperty('--background','rgba(255,255,255,0.08)');
        document.documentElement.style.setProperty('--border','1px solid rgba(255,255,255,0.25)');
    }
}

function checkForm(){
    var nameInput=document.getElementById("name");
    var nameValue=nameInput.value;
    if (nameValue.length==0){
        alert("Please enter your name.");
        return false;
    }
    var emailInput=document.getElementById("email");
    var emailValue=emailInput.value;
    if (emailValue.length==0){
        alert("Please enter your email address.");
        return false;
    }
    if (emailValue.indexOf('@')===-1||emailValue.indexOf('.')===-1){
        alert("Please enter a valid email address.");
        return false;
    }
    return true;
}

function numberGuesser(){
    var secret=parseInt(Math.random()*10)+1;
    var guess=prompt("Guess a number between 1 and 10:");
    if (guess===null){
        return;
    }
    var value=Number(guess);
    if (value===secret){
        alert("Correct! The number was "+secret+".");
    }
    else {
        alert("Wrong. The number was "+secret+".");
    }
}

function multiplicationQuiz(){
    var a=parseInt(Math.random()*9)+1;
    var b=parseInt(Math.random()*9)+1;
    var answer=prompt("What is "+a+" x "+b+"?");
    if (answer===null){
        return;
    }
    if (Number(answer)===a*b){
        alert("Yes! "+a+" x "+b+" = "+(a*b));
    }
    else {
        alert("No. The answer is "+(a*b)+".");
    }
}

function additionChallenge(){
    var a=parseInt(Math.random()*20)+1;
    var b=parseInt(Math.random()*20)+1;
    var answer=prompt("What is "+a+" + "+b+"?");
    if (answer===null){
        return;
    }
    if (Number(answer)===a+b){
        alert("Good job! "+a+" + "+b+" = "+(a+b));
    }
    else {
        alert("The correct answer is "+(a+b)+".");
    }
}

function wordScramble(){
    var words=["code","game","fun","learn","play"];
    var word=words[parseInt(Math.random()*words.length)];
    var letters=word.split("");
    letters.sort(function(){
        return 0.5-Math.random();
    });
    var scrambled=letters.join("");
    var answer=prompt("Unscramble this word: "+scrambled);
    if (answer===null){
        return;
    }
    if (answer.toLowerCase()===word){
        alert("Correct! The word is "+word+".");
    }
    else {
        alert("Wrong. The word was "+word+".");
    }
}
