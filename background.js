chrome.runtime.onInstalled.addListener(function () {
	console.log("Reminder management extension installed.");
});

// Listen for alarms and display a notification
chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name.startsWith("reminder_")) {
		const reminderTitle = alarm.name.replace("reminder_", "");

		// Create a notification
		chrome.notifications.create({
			type: "basic",
			iconUrl: "icon.png",
			title: "Reminder",
			message: `It's time for: ${reminderTitle}`,
			priority: 2, // High priority
			requireInteraction: true
		});

		// Disable the reminder after it has been executed
		chrome.storage.local.get("reminders", (data) => {
			const reminders = data.reminders || [];
			const index = reminders.findIndex((r) => r.title === reminderTitle);
			if (index !== -1) {
				reminders[index].active = false;
				chrome.storage.local.set({ reminders });
			}
		});
	}
});

// Reset alarms with existing reminders when the extension starts
chrome.runtime.onStartup.addListener(() => {
	chrome.storage.local.get("reminders", (data) => {
		const reminders = data.reminders || [];
		reminders.forEach((reminder) => {
			if (reminder.active) {
				scheduleAlarm(reminder.title, reminder.time);
			}
		});
	});
});

// Listen for the message to set a reminder
chrome.runtime.onMessage.addListener((message) => {
	if (message.type === "set-alarm") {
		const { title, time, active } = message.reminder;
		if (active) {
			scheduleAlarm(title, time);
		}
	}
});

// Schedule an alarm for a reminder
function scheduleAlarm(title, time) {
	const now = new Date();
	const [hours, minutes] = time.split(":").map(Number);
	const alarmTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

	if (alarmTime < now) {
		alarmTime.setDate(alarmTime.getDate() + 1); // Set the alarm for the next day
	}

	const delayInMinutes = Math.max((alarmTime - now) / 60000, 0.5); // At least 30 seconds
	chrome.alarms.create(`reminder_${title}`, { delayInMinutes });
}
