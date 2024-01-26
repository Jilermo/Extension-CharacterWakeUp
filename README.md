# Extension-CharacterWakeUp
 Extension for SillyTavern that sends a message to the current chat at a specific hour. I'm using it as a wake-up alarm but it could be used as a general purpose reminder.

 To cancel the alarm and reset it press any key. This will stop all the upcoming repeat messages and will send a woke up message if enabled. And it will reset the alarm so it fires the next day.

To set up just set the hour and minute and disable and enable the extension with the I'm enabled checkbox.

The Wake up prompts are the messages that can be sent for the initial messages, they are separated with \n and if there is more than one one is picked at random.

Wake up repeat is if this extension should send repeat messages if the user doesn't press a key. You can set the messages sent and the time between messages (remember not to set too little time as it might try to send a new message while the AI is still answering.)

You can also enable an automatic woke up message when disabling the alarm by pressing any key. Note that even if you don't have set up a woke up message or repeat messages you still need to disable the alarm by pressing any key or the alarm won't fire next time.

As I said I developed this extension to use SillyTavern like an alarm clock that would send me a message every morning. My personal setup is using an external batch command to send the computer to sleep and to wake it up say 10 minutes before the alarm in SillyTavern is fired and then the alarm fires and with a TTS service you have an anime AI girlfriend waking you up.

If there is demand I might make this into a more general-purpose tool and allow it to set up multiple alarms at once but for now I'm done with this project. Hope you like it and if so leave me a star :D.
