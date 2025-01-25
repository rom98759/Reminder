document.addEventListener('DOMContentLoaded', function () {
	const persistentNotificationsCheckbox = document.getElementById('persistent-notifications');
	const darkThemeCheckbox = document.getElementById('dark-theme');
	const saveSettingsButton = document.getElementById('save-settings');
	const messageContainer = document.getElementById('message-container');

	// Charger les paramètres sauvegardés
	chrome.storage.sync.get(['persistentNotifications', 'darkTheme'], function (result) {
		persistentNotificationsCheckbox.checked = result.persistentNotifications || false;
		darkThemeCheckbox.checked = result.darkTheme || false;
		if (result.darkTheme) {
			document.body.classList.add('dark-theme');
		}
	});

	// Sauvegarder les paramètres et notifier les autres pages
	saveSettingsButton.addEventListener('click', function () {
		const persistentNotifications = persistentNotificationsCheckbox.checked;
		const darkTheme = darkThemeCheckbox.checked;

		chrome.storage.sync.set({ persistentNotifications, darkTheme }, function () {
			showMessage('✔️ Settings saved');

			// Appliquer le thème immédiatement
			if (darkTheme) {
				document.body.classList.add('dark-theme');
			} else {
				document.body.classList.remove('dark-theme');
			}

			// Notifier toutes les pages que les paramètres ont changé
			chrome.runtime.sendMessage({
				type: 'settings-changed',
				settings: { persistentNotifications, darkTheme }
			});
		});
	});

	function showMessage(message, isError = false) {
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
});
