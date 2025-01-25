document.addEventListener("DOMContentLoaded", function () {
	// Add event listener to the button
	const addReminderButton = document.getElementById("add-reminder");
	addReminderButton.addEventListener("click", function () {
		const title = document.getElementById("title").value;
		const time = document.getElementById("time").value;
		if (title && time) {
			addReminder(title, time);
			showMessage("Reminder added successfully.");
		} else {
			showMessage("Please enter both title and time.", true);
		}
	});

	loadReminders();
});

function renderReminders(reminders) {
	// Sort reminders by time
	reminders.sort((a, b) => {
		const [aHour, aMinute] = a.time.split(":").map(Number);
		const [bHour, bMinute] = b.time.split(":").map(Number);
		return aHour - bHour || aMinute - bMinute;
	});

	const list = document.getElementById("reminder-list");
	list.innerHTML = ''; // Clear the current list
	if (reminders.length === 0) {
		const message = document.createElement("div");
		message.textContent = "No reminders for today.";
		list.appendChild(message);
	} else {
		reminders.forEach((reminder, index) => {
			const reminderElement = document.createElement("div");
			reminderElement.classList.add("reminder-item");

			const truncatedTitle = reminder.title.length > 15 ? `${reminder.title.slice(0, 15)}.` : reminder.title;

			reminderElement.innerHTML = `
				<div class="reminder-item-content">
					<span>${truncatedTitle} at ${reminder.time}</span>
				</div>
				<div class="reminder-item-actions">
					<input type="checkbox" id="toggle-${index}" ${reminder.active ? 'checked' : ''}>
					<label for="toggle-${index}" class="toggle-switch"></label>
					<button class="icon">✏️</button>
					<button class="icon">❌</button>
				</div>
			`;

			// Add event listeners after adding the HTML
			const toggleSwitch = reminderElement.querySelector(`#toggle-${index}`);
			const editButton = reminderElement.querySelector('.icon:first-of-type');
			const deleteButton = reminderElement.querySelector('.icon:last-of-type');

			toggleSwitch.addEventListener('click', () => toggleReminder(index));
			editButton.addEventListener('click', () => editReminder(index, reminders));
			deleteButton.addEventListener('click', () => deleteReminder(index, reminders));

			list.appendChild(reminderElement);
		});
	}

	// Adjust the window height and width
	const height = document.body.scrollHeight; // Content height
	const width = document.body.scrollWidth > 200 ? document.body.scrollWidth : 200; // Minimum width
	window.resizeTo(width, height);  // Adjust width and height
}

function loadReminders() {
	chrome.storage.local.get(["reminders"], function (result) {
		const reminders = result.reminders || [];
		renderReminders(reminders);
	});
}

function addReminder(title, time) {
	chrome.storage.local.get(["reminders"], function (result) {
		const reminders = result.reminders || [];
		reminders.push({ title, time, active: true });
		chrome.storage.local.set({ reminders }, function () {
			loadReminders();
			scheduleNotification(title, time);
		});
	});
}

function toggleReminder(index) {
	chrome.storage.local.get(["reminders"], function (result) {
		const reminders = result.reminders || [];
		reminders[index].active = !reminders[index].active;
		chrome.storage.local.set({ reminders }, function () {
			loadReminders();
		});
	});
}

function editReminder(index, sortedReminders) {
	chrome.storage.local.get(["reminders"], function (result) {
		const reminders = result.reminders || [];
		const reminder = sortedReminders[index];
		const originalIndex = reminders.findIndex(r => r.title === reminder.title && r.time === reminder.time);

		const newTitle = prompt("Modify title", reminder.title);
		const newTime = prompt("Modify time (HH:MM)", reminder.time);

		if (newTitle && newTime) {
			// Remove the old alarm
			chrome.alarms.clear(reminder.title, () => {
				// Update the reminder
				reminders[originalIndex] = { title: newTitle, time: newTime, active: true };
				chrome.storage.local.set({ reminders }, function () {
					loadReminders();
					scheduleNotification(newTitle, newTime);
					showMessage("Reminder updated successfully.");
				});
			});
		}
	});
}

function deleteReminder(index, sortedReminders) {
	chrome.storage.local.get(["reminders"], function (result) {
		const reminders = result.reminders || [];
		const reminder = sortedReminders[index];
		const originalIndex = reminders.findIndex(r => r.title === reminder.title && r.time === reminder.time);

		// Remove the alarm
		chrome.alarms.clear(reminder.title, () => {
			// Remove the reminder from the list
			reminders.splice(originalIndex, 1);
			chrome.storage.local.set({ reminders }, function () {
				loadReminders();
				showMessage("Reminder deleted successfully.");
			});
		});
	});
}

function scheduleNotification(title, time) {
	const [hour, minute] = time.split(":").map(num => parseInt(num));
	const now = new Date();
	const alarmTime = new Date(now.setHours(hour, minute, 0, 0));
	if (alarmTime <= new Date()) {
		alarmTime.setDate(alarmTime.getDate() + 1);
	}

	// Send a message to set the alarm
	chrome.runtime.sendMessage({ type: 'set-alarm', reminder: { title, time, active: true } });
}

function showMessage(message, isError = false) {
	const messageContainer = document.getElementById("message-container");
	const msgDiv = document.createElement("div");
	msgDiv.classList.add("message");
	if (isError) msgDiv.classList.add("error");
	msgDiv.textContent = message;
	messageContainer.appendChild(msgDiv);
	setTimeout(() => {
		msgDiv.classList.add("show");
	}, 10);
	setTimeout(() => {
		msgDiv.classList.remove("show");
		msgDiv.classList.add("hide");
		setTimeout(() => {
			messageContainer.removeChild(msgDiv);
		}, 500);
	}, 2000);
}
