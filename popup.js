document.addEventListener("DOMContentLoaded", function () {
	const addReminderButton = document.getElementById("add-reminder");
	const settingsLink = document.querySelector(".settings-link");
	const body = document.body;

	// Charger les préférences utilisateur
	chrome.storage.sync.get(['darkTheme', 'persistentNotifications'], function (result) {
		if (result.darkTheme) {
			body.classList.add('dark-theme');
		} else {
			body.classList.remove('dark-theme');
		}
		window.persistentNotifications = result.persistentNotifications || false;
	});

	// Réagir aux changements d'options
	chrome.runtime.onMessage.addListener((message) => {
		if (message.type === 'settings-changed') {
			const { darkTheme, persistentNotifications } = message.settings;
			if (darkTheme) {
				body.classList.add('dark-theme');
			} else {
				body.classList.remove('dark-theme');
			}
			window.persistentNotifications = persistentNotifications;
		}
	});

	// Ajouter un rappel
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
						<span class="reminder-title">${truncatedTitle}</span> at <span class="reminder-time">${reminder.time}</span>
				</div>
				<div class="reminder-item-actions">
					<input type="checkbox" id="toggle-${index}" ${reminder.active ? 'checked' : ''}>
					<label for="toggle-${index}" class="toggle-switch"></label>
					<button class="icon edit-icon">✏️</button>
					<button class="icon delete-icon">❌</button>
				</div>
			`;

			// Add event listeners after adding the HTML
			const toggleSwitch = reminderElement.querySelector(`#toggle-${index}`);
			const editButton = reminderElement.querySelector('.edit-icon');
			const deleteButton = reminderElement.querySelector('.delete-icon');

			toggleSwitch.addEventListener('click', () => toggleReminder(index, reminders));
			editButton.addEventListener('click', () => enableEditMode(reminderElement, index, reminders));
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

function toggleReminder(index, sortedReminders) {
	chrome.storage.local.get(["reminders"], function (result) {
		const reminders = result.reminders || [];

		// Trouver l'index réel dans la liste originale
		const reminder = sortedReminders[index];
		const originalIndex = reminders.findIndex(r => r.title === reminder.title && r.time === reminder.time);

		if (originalIndex !== -1) {
			// Basculer l'état actif/inactif
			reminders[originalIndex].active = !reminders[originalIndex].active;
			chrome.storage.local.set({ reminders }, function () {
				loadReminders();
			});
		}
	});
}


function enableEditMode(reminderElement, index, sortedReminders) {
	const reminder = sortedReminders[index];
	const originalTitle = reminder.title;
	const originalTime = reminder.time;

	const titleSpan = reminderElement.querySelector('.reminder-title');
	const timeSpan = reminderElement.querySelector('.reminder-time');

	titleSpan.innerHTML = `<input type="text" class="edit-title" value="${originalTitle}">`;
	timeSpan.innerHTML = `<input type="time" class="edit-time" value="${originalTime}">`;

	const editTitleInput = reminderElement.querySelector('.edit-title');
	const editTimeInput = reminderElement.querySelector('.edit-time');

	editTitleInput.focus();

	const saveButton = document.createElement('button');
	saveButton.classList.add('icon', 'save-icon');
	saveButton.textContent = '✔️';
	reminderElement.querySelector('.reminder-item-actions').appendChild(saveButton);

	// Disable other buttons and inputs
	document.querySelectorAll('button').forEach(button => button.disabled = true);
	document.querySelectorAll('input').forEach(input => input.disabled = true);
	saveButton.disabled = false;
	editTitleInput.disabled = false;
	editTimeInput.disabled = false;
	document.querySelector(".settings-link").style.pointerEvents = 'none'; // Disable settings link

	saveButton.addEventListener('click', () => {
		saveEdit(reminderElement, index, sortedReminders);
		// Re-enable other buttons and inputs
		document.querySelectorAll('button').forEach(button => button.disabled = false);
		document.querySelectorAll('input').forEach(input => input.disabled = false);
		document.querySelector(".settings-link").style.pointerEvents = 'auto'; // Re-enable settings link
	});
}

function saveEdit(reminderElement, index, sortedReminders) {
	const editTitleInput = reminderElement.querySelector('.edit-title');
	const editTimeInput = reminderElement.querySelector('.edit-time');

	const newTitle = editTitleInput.value;
	const newTime = editTimeInput.value;

	if (newTitle && newTime) {
		chrome.storage.local.get(["reminders"], function (result) {
			const reminders = result.reminders || [];
			const reminder = sortedReminders[index];
			const originalIndex = reminders.findIndex(r => r.title === reminder.title && r.time === reminder.time);

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
		});
	} else {
		showMessage("Please enter both title and time.", true);
	}
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
	chrome.runtime.sendMessage({ type: 'set-alarm', reminder: { title, time, active: true, persistent: window.persistentNotifications } });
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
