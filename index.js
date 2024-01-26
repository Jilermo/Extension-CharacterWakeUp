import {
    saveSettingsDebounced,
    substituteParams,
} from '../../../../script.js';
import { debounce } from '../../../utils.js';
import { promptQuietForLoudResponse, sendMessageAs, sendNarratorMessage } from '../../../slash-commands.js';
import { extension_settings, getContext, renderExtensionTemplate } from '../../../extensions.js';
import { registerSlashCommand } from '../../../slash-commands.js';

const extensionName = 'third-party/Extension-CharacterWakeUp';
const extensionApodo = 'WakeUp';

let idleTimer = null;
let wakeUpAlarm = null;
let wakeUpAlarmTimeOut=null;
let wakeUpRepeatAlarm = null;
let wokeUpAlarm = null;
let repeatCount = 0;
let resetToDefaults=false;
let wakingUpUser=false;
let millisTillTime=10;

const settingsOptions = [
    ['WakeUp_enabled', 'enabled', true],
    ['WakeUp_hour', 'wakeUpHour'],
    ['WakeUp_minute', 'wakeUpMinute'],
    ['WakeUp_prompts', 'wakeUpPrompts'],    
    ['WakeUp_use_repeat', 'wakeUpRepeat', true],
    ['WakeUp_repeat_time', 'repeatTime'],
    ['WakeUp_max_Repeats', 'maxRepeats'],
    ['WakeUp_repeats_prompts', 'repeatPrompts'],
    ['WokeUp_message', 'useWokeUp'],    
    ['WakeUp_messages', 'wakeUpmessages'],            
    ['WakeUp_sendAs', 'sendAs'],    
];

let defaultSettings = {
    enabled: false,
    wakeUpHour:9,
    wakeUpMinute:0,
    wakeUpPrompts: [
        "It's the next day and it's time to wake up {{user}} send write a message to wake him up, remember to take into account his preferences.",
        "It's time to wake {{user}} up. Send him a small message.",
    ],  
    wakeUpRepeat: true,
    repeatTime: 300,
    maxRepeats: 1,    
    repeatPrompts: [
        "{{user}} doesn't give signs of waking up.",
        "{{user}} it's still fast asleep.",
    ],   
    useWokeUp:true,
    wakeUpmessages: [
        "{{User}} has already woke up",
        "{{char}} sees {{user}}'s eyes opening.",
    ],        
    sendAs: 'user',    
};



//TODO: Can we make this a generic function too?
/**
 * Populate the UI components with values from the extension settings.
 */
function populateUIWithSettings() {
    $('#WakeUp_enabled').prop('checked', extension_settings[extensionApodo].enabled).trigger('input');
    $('#WakeUp_hour').val(extension_settings[extensionApodo].wakeUpHour).trigger('input');
    $('#WakeUp_minute').val(extension_settings[extensionApodo].wakeUpMinute).trigger('input');
    $('#WakeUp_prompts').val(extension_settings[extensionApodo].wakeUpPrompts.join('\n')).trigger('input');
    $('#WakeUp_use_repeat').prop('checked', extension_settings[extensionApodo].wakeUpRepeat).trigger('input');
    $('#WakeUp_repeat_time').val(extension_settings[extensionApodo].repeatTime).trigger('input');
    $('#WakeUp_max_Repeats').val(extension_settings[extensionApodo].maxRepeats).trigger('input');
    $('#WakeUp_repeats_prompts').val(extension_settings[extensionApodo].repeatPrompts.join('\n')).trigger('input');
    $('#WokeUp_message').prop('checked', extension_settings[extensionApodo].useWokeUp).trigger('input');
    $('#WakeUp_messages').val(extension_settings[extensionApodo].wakeUpmessages.join('\n')).trigger('input');
}

//TODO: Can we make this a generic function?
/**
 * Load the extension settings and set defaults if they don't exist.
 */
async function loadSettings() {
    if (!extension_settings[extensionApodo] || resetToDefaults) {
        console.log('Creating extension_settings Character Wake Up');
        extension_settings[extensionApodo] = {};
    }
    for (const [key, value] of Object.entries(defaultSettings)) {        
        if (!extension_settings[extensionApodo].hasOwnProperty(key) || resetToDefaults) {
        console.log(`Setting default for: ${key}`);
        extension_settings[extensionApodo][key] = value;
        }
        
    }
    populateUIWithSettings();
}

//Wake Up Alarm

/**
 * Reset the idle timer based on the extension settings and context.
 */
function setWakeUpAlarm() {
    if (!extension_settings[extensionApodo].enabled) return;
    console.debug('SettingWakeUpAlarm');
    if (wakeUpAlarm) clearInterval(wakeUpAlarm);
    var now = new Date();
    var nowTime = new Date().getTime();
    var targetTime=new Date(now.getFullYear(), now.getMonth(), now.getDate(), extension_settings[extensionApodo].wakeUpHour, extension_settings[extensionApodo].wakeUpMinute, 0, 0).getTime()        
    var millisTill10 = targetTime-nowTime;
    if (millisTill10 < 0) {
        millisTill10 += 86400000; // it's after 10am, try 10am tomorrow.
        console.log("setting alarm for")
        console.log(new Date(targetTime+millisTill10))
    }else{
        console.log("setting alarm for")
        console.log(new Date(now.getFullYear(), now.getMonth(), now.getDate(), extension_settings[extensionApodo].wakeUpHour, extension_settings[extensionApodo].wakeUpMinute, 0, 0))
    }
    wakeUpAlarm = setInterval(handleInterval, 45000,extension_settings[extensionApodo].wakeUpHour,extension_settings[extensionApodo].wakeUpMinute,sendWakeUpMessage);
}

async function sendWakeUpMessage() {
    
    clearInterval(wakeUpAlarm);
    console.log("sending wake up message and wakeUpAlarm cleared")
    let context = getContext();
    if (!extension_settings[extensionApodo].enabled){
        return;
    }
    if (!context.characterId && !context.groupID){
        RescheduleWakeUpMessage();
        return;
    } 

    // Check repeat conditions and waiting for a response
    if ($('#mes_stop').is(':visible')) {
        console.debug("waiting for a response.");
        RescheduleWakeUpMessage();
        return;
    }

    const randomPrompt = extension_settings[extensionApodo].wakeUpPrompts[
        Math.floor(Math.random() * extension_settings[extensionApodo].wakeUpPrompts.length)
    ];

    sendWakeUpPrompt(randomPrompt);
    if(extension_settings[extensionApodo].wakeUpRepeat){
        SetWakeUpRepeatMessage();
    }
}

function RescheduleWakeUpMessage(){        
    if (wakeUpAlarmTimeOut) clearTimeout(wakeUpAlarmTimeOut);
    millisTill10 =120000;
    wakeUpAlarmTimeOut=setTimeout(sendWakeUpMessage, millisTill10);  
}

/**
 * Send the provided prompt to the AI. Determines method based on continuation setting.
 * @param {string} prompt - The prompt text to send to the AI.
 */
function sendWakeUpPrompt(prompt) {    
    clearTimeout(wakeUpAlarm);
    $('#send_textarea').off('input');
    console.debug('Sending idle prompt');
    console.log(extension_settings[extensionApodo]);
    sendLoud(extension_settings[extensionApodo].sendAs, prompt);
    wakingUpUser=true;
}

//Wake Up Alarm




//Repeat Alarm


function SetWakeUpRepeatMessage(){
    if (wakeUpRepeatAlarm) clearTimeout(wakeUpRepeatAlarm);
    if(repeatCount<=extension_settings[extensionApodo].maxRepeats){        
        wakeUpRepeatAlarm=setTimeout(SendWakeUpRepeatMessage, extension_settings[extensionApodo].repeatTime*1000); 
    }
    
}

function SendWakeUpRepeatMessage(){
    let context = getContext();
    if (!extension_settings[extensionApodo].enabled){
        return;
    }
    if (!context.characterId && !context.groupID){
        RescheduleWakeUpRepeatMessage();
        return;
    } 

    // Check repeat conditions and waiting for a response
    if ($('#mes_stop').is(':visible')) {
        console.debug("waiting for a response.");
        RescheduleWakeUpRepeatMessage();
        return;
    }

    const randomPrompt = extension_settings[extensionApodo].repeatPrompts[
        Math.floor(Math.random() * extension_settings[extensionApodo].repeatPrompts.length)
    ];

    sendWakeUpRepeatPrompt(randomPrompt);

    SetWakeUpRepeatMessage();
}

function RescheduleWakeUpRepeatMessage(){        
    if (wakeUpRepeatAlarm) clearTimeout(wakeUpRepeatAlarm);    
    wakeUpRepeatAlarm=setTimeout(SendWakeUpRepeatMessage, 120000);  
}

/**
 * Send the provided prompt to the AI. Determines method based on continuation setting.
 * @param {string} prompt - The prompt text to send to the AI.
 */
function sendWakeUpRepeatPrompt(prompt) {
    clearTimeout(wakeUpRepeatAlarm);
    $('#send_textarea').off('input');

    console.debug('Sending idle prompt');
    console.log(extension_settings[extensionApodo]);
    repeatCount++
    sendLoud(extension_settings[extensionApodo].sendAs, prompt);    
}



//Repeat Alarm

//Already wake up
const debouncedActivityHandler = debounce((event) => {
    // Check if the event target (or any of its parents) has the id "option_continue"
    if ($(event.target).closest('#option_continue').length) {
        return; // Do not proceed if the click was on (or inside) an element with id "option_continue"
    }        
    if(wakingUpUser){
        wakingUpUser=false;
        if (wakeUpRepeatAlarm) clearTimeout(wakeUpRepeatAlarm);        
        repeatCount = 0;
        SendWokeUpMessage();
        setWakeUpAlarm()
    }
    
}, 250);


function SendWokeUpMessage(){
    let context = getContext();
    if (!extension_settings[extensionApodo].enabled){        
        return;
    }
    if (!context.characterId && !context.groupID){
        RescheduleWokeUpMessage();
        return;
    } 
    
    // Check repeat conditions and waiting for a response
    if ($('#mes_stop').is(':visible')) {
        console.debug("waiting for a response.");
        RescheduleWokeUpMessage();
        return;
    }

    const randomPrompt = extension_settings[extensionApodo].wakeUpmessages[
        Math.floor(Math.random() * extension_settings[extensionApodo].wakeUpmessages.length)
    ];

    sendWokeUpPrompt(randomPrompt);
}

function RescheduleWokeUpMessage(){        
    if (wokeUpAlarm) clearTimeout(wokeUpAlarm);
    millisTill10 =120000;
    wokeUpAlarm=setTimeout(SendWokeUpMessage, millisTill10);  
}

/**
 * Send the provided prompt to the AI. Determines method based on continuation setting.
 * @param {string} prompt - The prompt text to send to the AI.
 */
function sendWokeUpPrompt(prompt) {
    if (wokeUpAlarm) clearTimeout(wokeUpAlarm);
    $('#send_textarea').off('input');

    console.debug('Sending Woke Up prompt prompt');
    console.log(extension_settings[extensionApodo]);    
    if(extension_settings[extensionApodo].useWokeUp){
        sendLoud(extension_settings[extensionApodo].sendAs, prompt);    
    }
    
}
//Already wake up

function handleInterval(hour,minute,functionToCall){
    var currentdate = new Date();
    if(hour==currentdate.getHours() && minute==currentdate.getMinutes()){
        console.log("calling function")
        functionToCall();
    }
}

/**
 * Add our prompt to the chat and then send the chat to the backend.
 * @param {string} sendAs - The type of message to send. "user", "char", or "sys".
 * @param {string} prompt - The prompt text to send to the AI.
 */
function sendLoud(sendAs, prompt) {
    if (sendAs === 'user') {
        prompt = substituteParams(prompt);

        $('#send_textarea').val(prompt);

        // Set the focus back to the textarea
        $('#send_textarea').focus();

        $('#send_but').trigger('click');
    } else if (sendAs === 'char') {
        sendMessageAs('', `${getContext().name2}\n${prompt}`);
        promptQuietForLoudResponse(sendAs, '');
    } else if (sendAs === 'sys') {
        sendNarratorMessage('', prompt);
        promptQuietForLoudResponse(sendAs, '');
    }
    else {
        console.error(`Unknown sendAs value: ${sendAs}`);
    }
}

/**
 * Send the provided prompt to the AI. Determines method based on continuation setting.
 * @param {string} prompt - The prompt text to send to the AI.
 */
function sendPrompt(prompt) {
    clearTimeout(idleTimer);
    $('#send_textarea').off('input');

    if (extension_settings[extensionApodo].useContinuation) {
        $('#option_continue').trigger('click');
        console.debug('Sending idle prompt with continuation');
    } else {
        console.debug('Sending idle prompt');
        console.log(extension_settings[extensionApodo]);
        if (extension_settings[extensionApodo].includePrompt) {
            sendLoud(extension_settings[extensionApodo].sendAs, prompt);
        }
        else {
            promptQuietForLoudResponse(extension_settings[extensionApodo].sendAs, prompt);
        }
    }
}


/**
 * Load the settings HTML and append to the designated area.
 */
async function loadSettingsHTML() {
    const settingsHtml2 = renderExtensionTemplate(extensionName, 'dropdown');
    $('#extensions_settings2').append(settingsHtml2);
}

/**
 * Update a specific setting based on user input.
 * @param {string} elementId - The HTML element ID tied to the setting.
 * @param {string} property - The property name in the settings object.
 * @param {boolean} [isCheckbox=false] - Whether the setting is a checkbox.
 */
function updateSetting(elementId, property, isCheckbox = false) {
    let value = $(`#${elementId}`).val();
    if (isCheckbox) {
        value = $(`#${elementId}`).prop('checked');
    }

    if (property === 'repeatPrompts') {
        value = value.split('\n');
    }    
    extension_settings[extensionApodo][property] = value;
    saveSettingsDebounced();
}

/**
 * Attach an input listener to a UI component to update the corresponding setting.
 * @param {string} elementId - The HTML element ID tied to the setting.
 * @param {string} property - The property name in the settings object.
 * @param {boolean} [isCheckbox=false] - Whether the setting is a checkbox.
 */
function attachUpdateListener(elementId, property, isCheckbox = false) {
    $(`#${elementId}`).on('input', debounce(() => {
        updateSetting(elementId, property, isCheckbox);
    }, 250));
}

/**
 * Handle the enabling or disabling of the idle extension.
 * Adds or removes the idle listeners based on the checkbox's state.
 */
function handleWakeUpEnabled() {    
    if (!extension_settings[extensionApodo].enabled) {
        if (wakeUpAlarm) clearInterval(wakeUpAlarm)
        if (wakeUpAlarmTimeOut) clearTimeout(wakeUpAlarmTimeOut);
        if (wakeUpRepeatAlarm) clearTimeout(wakeUpRepeatAlarm);
        if (wokeUpAlarm) clearTimeout(wokeUpAlarm);
        wakingUpUser=false;
        clearTimeout(idleTimer);
        removeIdleListeners();
    } else {
        if (wakeUpAlarm) clearInterval(wakeUpAlarm)
        if (wakeUpAlarmTimeOut) clearTimeout(wakeUpAlarmTimeOut);
        if (wakeUpRepeatAlarm) clearTimeout(wakeUpRepeatAlarm);
        if (wokeUpAlarm) clearTimeout(wokeUpAlarm);
        wakingUpUser=false;
        setWakeUpAlarm();
        attachIdleListeners();
    }
}


/**
 * Setup input listeners for the various settings and actions related to the idle extension.
 */
function setupListeners() {   
     
    settingsOptions.forEach(setting => {
        attachUpdateListener(...setting);
    });

    // Idleness listeners, could be made better
    $('#WakeUp_enabled').on('input', debounce(handleWakeUpEnabled, 250));

    // Add the idle listeners initially if the idle feature is enabled
    if (extension_settings[extensionApodo].enabled) {
        attachIdleListeners();
    }

    //show/hide timer min parent div
    $('#WakeUp_use_repeat').on('input', function () {
        if ($(this).prop('checked')) {            
            $('#WakeUp_repeat_time').parent().show();
            $('#WakeUp_max_Repeats').parent().show();
            $('#WakeUp_repeats_prompts').parent().show();            
        } else {
            $('#WakeUp_repeat_time').parent().hide();
            $('#WakeUp_max_Repeats').parent().hide();
            $('#WakeUp_repeats_prompts').parent().hide();            
        }
        //$('#WakeUp_timer').trigger('input');
    });

    // if we're including the prompt, hide raw from the sendAs dropdown
    /*
    $('#WakeUp_include_prompt').on('input', function () {
        if ($(this).prop('checked')) {
            $('#WakeUp_sendAs option[value="raw"]').hide();
        } else {
            $('#WakeUp_sendAs option[value="raw"]').show();
        }
    });
    */

    //make sure timer min is less than timer
    /*
    $('#WakeUp_timer').on('input', function () {
        if ($('#WakeUp_random_time').prop('checked')) {
            if ($(this).val() < $('#WakeUp_timer_min').val()) {
                $('#WakeUp_timer_min').val($(this).val());
                $('#WakeUp_timer_min').trigger('input');
            }
        }
    });
    */

}


function attachIdleListeners() {
    //$(document).on('click keypress', debouncedActivityHandler);
    document.addEventListener('keydown', debouncedActivityHandler);
}

/**
 * Remove idle-specific listeners.
 */
function removeIdleListeners() {
    //$(document).off('click keypress', debouncedActivityHandler);
    document.removeEventListener('keydown', debouncedActivityHandler);
}

function toggleWakeUp() {
    extension_settings[extensionApodo].enabled = !extension_settings[extensionApodo].enabled;
    $('#WakeUp_enabled').prop('checked', extension_settings[extensionApodo].enabled);
    $('#WakeUp_enabled').trigger('input');
    toastr.info(`Wake up mode ${extension_settings[extensionApodo].enabled ? 'enabled' : 'disabled'}.`);
}


jQuery(async () => {
    console.log('Starting Character Wake up');    
    await loadSettingsHTML();
    loadSettings();
    setupListeners();
    handleWakeUpEnabled();    
    // once the doc is ready, check if random time is checked and hide/show timer min
    /*
    if ($('#WakeUp_random_time').prop('checked')) {
        $('#WakeUp_timer_min').parent().show();
    }
    */
    registerSlashCommand('WakeUpCharacter', toggleWakeUp, [], '– toggles Wake Up mode', true, true);
    console.log('Ending Character Wake up');
});
