class NewTabHomepage {
    constructor() {
        this.DEBUG = false; // Set to true for debugging
        this.log('NewTabHomepage constructor called');
        this.isEditing = false;
        this.editBtn = document.getElementById('editBtn');
        this.addLinkBtn = document.getElementById('customizeAddLinkBtn');
        this.themeSelector = document.getElementById('themeSelector');
        this.themeSelect = document.getElementById('themeSelect');
        this.saveNotification = document.getElementById('saveNotification');
        this.editPanel = document.getElementById('editPanel');

        // User Profile & Sync elements
        this.profileBtn = document.getElementById('profileBtn');
        this.syncBtn = document.getElementById('syncBtn');
        this.profilePanel = document.getElementById('profilePanel');
        this.closeProfilePanel = document.getElementById('closeProfilePanel');
        this.profileIndicator = document.getElementById('profileIndicator');
        this.syncStatus = document.getElementById('syncStatus');
        
        // Initialize Profile Manager
        this.userProfileManager = new UserProfileManager();
        this.setupProfileEventListeners();

        
        // Reminder elements
        this.reminderWidget = document.getElementById('reminderWidget');
        this.addReminderBtn = document.getElementById('addReminderBtn');
        this.reminderModal = document.getElementById('reminderModal');
        this.closeReminderModal = document.getElementById('closeReminderModal');
        this.reminderList = document.getElementById('reminderList');
        this.saveReminderBtn = document.getElementById('saveReminder');
        this.cancelReminderBtn = document.getElementById('cancelReminder');
        this.noReminders = document.getElementById('noReminders');
        
        // Reminder data
        this.reminders = JSON.parse(localStorage.getItem('reminders')) || [];
        this.editableElements = document.querySelectorAll('.editable');
        this.currentSearchEngine = 'startpage';
        this.pendingCitySelection = null; // Store selected city before saving
        this.weatherRefreshTimer = null; // Store weather refresh interval
        this.weatherRefreshInterval = 30; // Default: 30 minutes
        this.weatherEffectsEnabled = false; // Whether to show weather effects on regular themes
        this.weatherCloudsEnabled = false; // Whether to show realistic clouds (default disabled)
        this.weatherWidgetFrostEnabled = true; // Weather widget frost effect
        this.remindersWidgetFrostEnabled = true; // Reminders widget frost effect
        this.quicklinksWidgetFrostEnabled = true; // Quick Links widget frost effect
        this.currentTheme = 'ocean'; // Track current theme
        
        // Store interval IDs for cleanup
        this.intervals = {
            time: null,
            greeting: null,
            weather: null,
            refreshTooltip: null,
            reminders: null
        };
        
        this.log('Constructor - editBtn:', this.editBtn);
        this.log('Constructor - addLinkBtn:', this.addLinkBtn);
        this.log('Constructor - saveNotification:', this.saveNotification);
        
        this.searchEngines = {
            startpage: { url: 'https://www.startpage.com/sp/search?q=', placeholder: 'Search Startpage...' },
            youtube: { url: 'https://www.youtube.com/results?search_query=', placeholder: 'Search YouTube...' },
            duckduckgo: { url: 'https://duckduckgo.com/?q=', placeholder: 'Search DuckDuckGo...' },
            google: { url: 'https://www.google.com/search?q=', placeholder: 'Search Google...' }
        };
        
        this.init();
    }

    init() {
        this.updateTime();
        this.setGreeting();
        this.getWeatherData();
        this.setupEventListeners();
        this.loadSavedContent(); // Load saved content first (populates linksGrid)
        this.loadSavedTheme();
        this.setupAutoSave();
        this.setupWeatherRefresh(); // Setup automatic weather refresh
        
        // Initialize profile system
        this.initializeProfileSystem();
        
        // Initialize draggable widgets
        this.initDraggableWidgets();
        
        // Initialize quick links widget AFTER loading content (moves links from linksGrid to widget)
        this.initQuickLinksWidget();
        
        // Initialize customize panel (in case page was refreshed with panel open)
        setTimeout(() => {
            this.reinitializeCustomizeTab();
        }, 500);
        
        // Store interval IDs for cleanup
        this.intervals.time = setInterval(() => this.updateTime(), 1000);
        this.intervals.greeting = setInterval(() => this.setGreeting(), 5 * 60 * 1000);
        this.intervals.weather = setInterval(() => this.getWeatherData(), 10 * 60 * 1000);
        this.intervals.refreshTooltip = setInterval(() => this.updateRefreshTooltip(), 60 * 1000);
    }

    /**
     * Cleanup method to prevent memory leaks
     * Call this when destroying the instance
     */
    destroy() {
        // Clear all intervals
        Object.values(this.intervals).forEach(intervalId => {
            if (intervalId) clearInterval(intervalId);
        });
        
        // Clear weather refresh timer
        if (this.weatherRefreshTimer) {
            clearInterval(this.weatherRefreshTimer);
        }
        
        // Stop profile sync
        if (this.userProfileManager) {
            this.userProfileManager.stopPeriodicSync();
        }
        
        this.log('NewTabHomepage instance cleaned up');
    }

    /**
     * Debug logging - only logs when DEBUG flag is true
     */
    log(...args) {
        if (this.DEBUG) {
            console.log(...args);
        }
    }

    /**
     * Debounce utility function
     * Delays execution until after specified wait time has elapsed since last call
     * @param {Function} func - Function to debounce
     * @param {number} wait - Milliseconds to wait
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    setupEventListeners() {
        this.log('Setting up event listeners...');
        
        // Edit button toggle (now handled in dropdown)
        if (this.editBtn) {
            this.editBtn.addEventListener('click', () => {
                this.closeProfileDropdown();
                this.toggleEditMode();
            });
        }

        // Edit panel close button
        const closeEditPanel = document.getElementById('closeEditPanel');
        if (closeEditPanel) {
            closeEditPanel.addEventListener('click', () => {
                this.closeEditPanel();
            });
        }

        // Initialize reminders
        this.initReminders();

        // Search functionality - Enter key for currently selected search engine
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    // Use currently selected search engine instead of default
                    this.performSearch(this.currentSearchEngine);
                }
            });
        }

        // Search engine tabs - switch engine and focus input
        const searchTabs = document.querySelectorAll('.search-tab');
        searchTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const engine = tab.dataset.engine;
                this.switchSearchEngine(engine);
                
                // Focus the search input after switching
                if (searchInput) {
                    searchInput.focus();
                }
                
                // Only perform search if there's already text in the input
                if (searchInput && searchInput.value.trim()) {
                    this.performSearch(engine);
                }
            });
        });

        // Add link button
        this.log('Add link button:', this.addLinkBtn);
        if (this.addLinkBtn && !this.addLinkBtn.dataset.initialized) {
            this.addLinkBtn.addEventListener('click', (e) => {
                this.log('Add link button event triggered');
                e.preventDefault();
                this.addLink();
            });
            this.addLinkBtn.dataset.initialized = 'true';
            this.log('Add link button event listener attached successfully');
        } else if (this.addLinkBtn) {
            this.log('Add link button already initialized');
        } else {
            console.error('Add link button not found during setup!');
        }

        // Weather location click to change city - opens edit panel
        const weatherLocation = document.getElementById('weatherLocation');
        if (weatherLocation) {
            weatherLocation.addEventListener('click', (e) => {
                // Always open edit panel to change weather location
                e.preventDefault();
                this.changeWeatherCity();
            });
            weatherLocation.style.cursor = 'pointer';
            weatherLocation.title = 'Click to change location';
        }

        // Update weather button in edit panel
        const updateWeatherBtn = document.getElementById('updateWeatherBtn');
        const weatherLocationInput = document.getElementById('weatherLocationInput');
        if (updateWeatherBtn && weatherLocationInput) {
            updateWeatherBtn.addEventListener('click', () => {
                const city = weatherLocationInput.value.trim();
                if (city) {
                    this.fetchWeatherByCity(city);
                }
            });
            
            weatherLocationInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const city = weatherLocationInput.value.trim();
                    if (city) {
                        this.fetchWeatherByCity(city);
                    }
                }
            });
        }

        // Weather refresh interval selector
        const weatherRefreshSelect = document.getElementById('weatherRefreshInterval');
        const customIntervalInput = document.getElementById('customIntervalInput');
        const customIntervalValue = document.getElementById('customIntervalValue');
        const customIntervalUnit = document.getElementById('customIntervalUnit');
        
        if (weatherRefreshSelect) {
            weatherRefreshSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    customIntervalInput.style.display = 'block';
                } else {
                    customIntervalInput.style.display = 'none';
                    this.weatherRefreshInterval = parseInt(e.target.value);
                    this.saveWeatherRefreshInterval(this.weatherRefreshInterval);
                    this.setupWeatherRefresh();
                }
            });
        }
        
        // Custom interval inputs
        if (customIntervalValue && customIntervalUnit) {
            const applyCustomInterval = () => {
                const value = parseInt(customIntervalValue.value);
                const unit = customIntervalUnit.value;
                
                if (value && value > 0) {
                    // Convert to minutes
                    const minutes = unit === 'seconds' ? value / 60 : value;
                    this.weatherRefreshInterval = minutes;
                    this.saveWeatherRefreshInterval(minutes);
                    this.setupWeatherRefresh();
                }
            };
            
            customIntervalValue.addEventListener('change', applyCustomInterval);
            customIntervalUnit.addEventListener('change', applyCustomInterval);
        }

        // Theme selector change
        if (this.themeSelect) {
            this.themeSelect.addEventListener('change', (e) => {
                this.changeTheme(e.target.value);
            });
        }

        // Weather effects toggle checkbox
        const weatherEffectsToggle = document.getElementById('weatherEffectsToggle');
        if (weatherEffectsToggle) {
            // Load saved preference or use default (false)
            const savedEffectsPref = localStorage.getItem('weatherEffectsEnabled');
            if (savedEffectsPref !== null) {
                this.weatherEffectsEnabled = savedEffectsPref === 'true';
            } else {
                this.weatherEffectsEnabled = false; // Default unchecked
            }
            weatherEffectsToggle.checked = this.weatherEffectsEnabled;
            
            weatherEffectsToggle.addEventListener('change', (e) => {
                this.weatherEffectsEnabled = e.target.checked;
                localStorage.setItem('weatherEffectsEnabled', this.weatherEffectsEnabled);
                
                // If on a weather theme, re-apply it with or without effects
                if (this.currentTheme === 'weather' || this.currentTheme === 'weather-dark') {
                    this.removeWeatherEffects();
                    if (this.weatherEffectsEnabled) {
                        this.applyWeatherTheme(this.currentTheme === 'weather-dark');
                    } else {
                        // Just apply gradient without effects
                        this.applyWeatherTheme(this.currentTheme === 'weather-dark', true);
                    }
                } else {
                    // Regular theme - just add or remove effects
                    if (this.weatherEffectsEnabled) {
                        this.applyWeatherEffectsOnly();
                    } else {
                        this.removeWeatherEffects();
                    }
                }
            });
            
            // Weather clouds checkbox
            const weatherCloudsToggle = document.getElementById('weatherCloudsToggle');
            if (weatherCloudsToggle) {
                const savedCloudsPref = localStorage.getItem('weatherCloudsEnabled');
                if (savedCloudsPref !== null) {
                    this.weatherCloudsEnabled = savedCloudsPref === 'true';
                } else {
                    this.weatherCloudsEnabled = false; // Default unchecked
                }
                weatherCloudsToggle.checked = this.weatherCloudsEnabled;
            }
            
            weatherCloudsToggle.addEventListener('change', (e) => {
                this.weatherCloudsEnabled = e.target.checked;
                localStorage.setItem('weatherCloudsEnabled', this.weatherCloudsEnabled);
                
                // Re-apply weather elements independently
                if (this.currentTheme === 'weather' || this.currentTheme === 'weather-dark') {
                    this.removeWeatherEffects();
                    this.applyWeatherTheme(this.currentTheme === 'weather-dark');
                } else if (this.weatherEffectsEnabled || this.weatherCloudsEnabled) {
                    // Re-apply effects or elements that are enabled
                    this.removeWeatherEffects();
                    this.applyWeatherEffectsOnly();
                }
            });
        }

        // Setup remove buttons for default links
        this.setupDefaultLinkRemoval();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Prevent shortcuts when typing in editable elements
            if (e.target.contentEditable === 'true' || e.target.tagName === 'INPUT') {
                return;
            }
            
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault();
                this.toggleEditMode();
            }
            if (e.ctrlKey && e.key === 's' && this.isEditing) {
                e.preventDefault();
                this.saveContent();
            }
            if (e.key === '/' && !this.isEditing && searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
            // ESC to exit edit mode
            if (e.key === 'Escape' && this.isEditing) {
                this.toggleEditMode();
            }
        });

        // Auto-save functionality for editable elements
        this.setupAutoSaveListeners();
    }

    setupAutoSaveListeners() {
        // Re-attach listeners to all editable elements
        const editableElements = document.querySelectorAll('.editable');
        editableElements.forEach(element => {
            // Remove existing listeners to avoid duplicates
            element.removeEventListener('blur', this.handleBlur);
            element.removeEventListener('input', this.handleInput);
            
            // Add new listeners
            element.addEventListener('blur', this.handleBlur.bind(this));
            element.addEventListener('input', this.handleInput.bind(this));
        });
    }

    handleBlur(e) {
        if (this.isEditing) {
            // If weather location was edited, update weather
            if (e.target.id === 'weatherLocation') {
                const newCity = e.target.textContent.trim();
                if (newCity && newCity !== 'Loading...' && newCity !== 'Your City') {
                    setTimeout(() => {
                        this.loadWeather(newCity);
                    }, 200);
                }
            }
            setTimeout(() => this.saveContent(), 100);
        }
    }

    handleInput(e) {
        if (this.isEditing) {
            // Debounced save
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => this.saveContent(), 1000);
        }
    }

    toggleEditMode() {
        const editPanel = document.getElementById('editPanel');
        
        // Only allow enabling edit mode if panel is open
        if (!this.isEditing && editPanel && !editPanel.classList.contains('open')) {
            // If panel is closed, open it and enable edit mode
            this.openEditPanel();
            return;
        }
        
        this.isEditing = !this.isEditing;
        
        if (this.isEditing) {
            this.enableEditMode();
        } else {
            this.disableEditMode();
            this.saveContent();
        }
    }

    enableEditMode() {
        const editPanel = document.getElementById('editPanel');
        
        // Only enable edit mode if panel is open
        if (!editPanel || !editPanel.classList.contains('open')) {
            return;
        }
        
        document.body.classList.add('editing');
        this.editBtn.innerHTML = '<i class="fas fa-times"></i> Close';
        this.editBtn.classList.add('editing');

        // Show edit panel with animation
        if (this.editPanel) {
            this.editPanel.classList.add('active');
        }

        // Enable contenteditable for all editable elements
        const editableElements = document.querySelectorAll('.editable');
        editableElements.forEach(element => {
            element.contentEditable = true;
        });

        // Show add buttons
        const addButtons = document.querySelectorAll('.add-link-btn');
        addButtons.forEach(btn => {
            btn.style.display = 'flex';
        });

        // Show remove buttons on hover - look in quicklinks widget content
        const quicklinksContent = document.getElementById('quicklinksContent');
        const linkContainer = quicklinksContent || document.getElementById('linksGrid');
        if (linkContainer) {
            const linkItems = linkContainer.querySelectorAll('.link-item');
            linkItems.forEach(item => {
                const removeBtn = item.querySelector('.remove-btn');
                if (removeBtn) {
                    item.addEventListener('mouseenter', () => {
                        if (this.isEditing) removeBtn.style.display = 'block';
                    });
                    item.addEventListener('mouseleave', () => {
                        removeBtn.style.display = 'none';
                    });
                }
            });
        }

        // Setup auto-save listeners for any new elements
        this.setupAutoSaveListeners();
    }

    disableEditMode() {
        document.body.classList.remove('editing');
        this.editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
        this.editBtn.classList.remove('editing');

        // Hide edit panel
        if (this.editPanel) {
            this.editPanel.classList.remove('active');
        }

        // Disable contenteditable for all editable elements
        const editableElements = document.querySelectorAll('.editable');
        editableElements.forEach(element => {
            element.contentEditable = false;
            element.blur(); // Remove focus
        });

        // Hide add buttons
        const addButtons = document.querySelectorAll('.add-link-btn');
        addButtons.forEach(btn => {
            btn.style.display = 'none';
        });

        // Hide all remove buttons
        const removeButtons = document.querySelectorAll('.remove-btn');
        removeButtons.forEach(btn => {
            btn.style.display = 'none';
        });

        // Final save
        this.saveContent();
    }

    updateTime() {
        const now = new Date();
        const timeElement = document.getElementById('currentTime');
        const dateElement = document.getElementById('currentDate');
        
        // Format time
        const timeOptions = { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        };
        const timeString = now.toLocaleTimeString('en-US', timeOptions);
        
        // Format date
        const dateOptions = { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
        };
        const dateString = now.toLocaleDateString('en-US', dateOptions);
        
        if (timeElement) timeElement.textContent = timeString;
        if (dateElement) dateElement.textContent = dateString;
    }

    setGreeting() {
        const now = new Date();
        const hour = now.getHours();
        const greetingElement = document.getElementById('greeting');
        
        // Skip if typewriter animation hasn't finished yet
        if (!greetingElement) return;
        
        let greeting;
        
        this.log(`Current hour: ${hour}`); // Debug log for timezone issues
        
        // Get season and add appropriate emoji
        const month = now.getMonth();
        let seasonEmoji = '';
        if (month >= 2 && month <= 4) seasonEmoji = '🌸'; // Spring
        else if (month >= 5 && month <= 7) seasonEmoji = '☀️'; // Summer
        else if (month >= 8 && month <= 10) seasonEmoji = '🍂'; // Fall
        else seasonEmoji = '❄️'; // Winter
        
        // Get current weather emoji if available
        const weatherEmoji = this.getCurrentWeatherEmoji();
        
        if (hour >= 5 && hour < 12) {
            greeting = `Good morning ${seasonEmoji}${weatherEmoji}`;
        } else if (hour >= 12 && hour < 17) {
            greeting = `Good afternoon ${seasonEmoji}${weatherEmoji}`;
        } else if (hour >= 17 && hour < 22) {
            greeting = `Good evening 🌙${seasonEmoji}${weatherEmoji}`;
        } else {
            greeting = `Good night 😴${seasonEmoji}${weatherEmoji}`;  // 22:00 - 05:00
        }
        
        if (greetingElement) {
            greetingElement.textContent = greeting;
        }
    }

    getCurrentWeatherEmoji() {
        // Get weather emoji based on current conditions
        const weatherIcon = document.getElementById('weatherIcon');
        if (!weatherIcon) return '';
        
        const iconElement = weatherIcon.querySelector('i');
        if (!iconElement) return '';
        
        const iconClass = iconElement.className;
        
        if (iconClass.includes('fa-sun')) return ' ☀️';
        if (iconClass.includes('fa-cloud-sun')) return ' ⛅';
        if (iconClass.includes('fa-cloud-rain')) return ' 🌧️';
        if (iconClass.includes('fa-cloud')) return ' ☁️';
        if (iconClass.includes('fa-snowflake')) return ' ❄️';
        if (iconClass.includes('fa-bolt')) return ' ⛈️';
        if (iconClass.includes('fa-smog')) return ' 🌫️';
        if (iconClass.includes('fa-moon')) return ' 🌙';
        
        return '';
    }

    async getWeatherData() {
        try {
            // First try to load saved weather data
            const savedContent = localStorage.getItem('newTabContent');
            
            if (savedContent) {
                try {
                    const content = JSON.parse(savedContent);
                    
                    // If we have saved weather data, restore it instead of fetching
                    if (content.savedWeatherData) {
                        this.log('Restoring saved weather:', content.savedWeatherData);
                        this.restoreSavedWeather(content.savedWeatherData);
                        return;
                    }
                } catch (e) {
                    this.log('Error parsing saved content');
                }
            }
            
            this.log('No saved weather data found, using default');
            // No saved weather data, use simulated weather for default city
            this.setDefaultWeather();
        } catch (error) {
            console.error('Weather fetch error:', error);
            this.setDefaultWeather();
        }
    }

    /**
     * Fetch with timeout wrapper
     * @param {string} url - URL to fetch
     * @param {number} timeout - Timeout in milliseconds (default 10000)
     * @returns {Promise} Fetch response
     */
    async fetchWithTimeout(url, timeout = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - please check your internet connection');
            }
            throw error;
        }
    }

    async fetchWeatherByCity(cityName, autoRefresh = false) {
        // Show loading indicator
        const weatherWidget = document.querySelector('.weather-widget');
        if (weatherWidget && !autoRefresh) {
            weatherWidget.classList.add('loading');
        }

        try {
            // Check which API provider to use
            const apiProvider = this.getWeatherApiProvider();
            
            if (apiProvider === 'openweather') {
                await this.fetchWeatherFromOpenWeather(cityName, autoRefresh);
            } else {
                // Default: Open-Meteo
                const geocodeResponse = await this.fetchWithTimeout(
                    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=10&language=en&format=json`
                );
                
                if (!geocodeResponse.ok) {
                    throw new Error('Geocoding API error');
                }
                
                const geocodeData = await geocodeResponse.json();
                if (!geocodeData.results || geocodeData.results.length === 0) {
                    this.showWeatherError('City not found. Please check the spelling and try again.');
                    return;
                }
                
                // If auto-refresh or single result, use first result and save
                if (autoRefresh || geocodeData.results.length === 1) {
                    const cityResult = geocodeData.results[0];
                    await this.fetchWeatherForLocation(cityResult.latitude, cityResult.longitude, cityResult, true);
                    return;
                }
                
                // Multiple results and manual search - show selection dropdown
                this.showCitySelectionDropdown(geocodeData.results);
            }
        } catch (error) {
            console.error('Weather API error:', error);
            this.showWeatherError(
                error.message.includes('timeout') 
                    ? 'Request timeout - please check your internet connection'
                    : 'Unable to fetch weather data. Please try again.'
            );
        } finally {
            // Remove loading indicator
            if (weatherWidget) {
                weatherWidget.classList.remove('loading');
            }
        }
    }

    async fetchWeatherForLocation(latitude, longitude, cityData, shouldSave = true) {
        try {
            // Get weather data using coordinates with timeout
            const weatherResponse = await this.fetchWithTimeout(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`
            );
            
            if (!weatherResponse.ok) {
                throw new Error('Weather API error');
            }
            
            const weatherData = await weatherResponse.json();
            this.updateWeatherDisplayFromOpenMeteo(weatherData, cityData, shouldSave);
            
            // Save the original city name for future searches only if saving
            if (shouldSave && cityData && cityData.name) {
                this.saveOriginalCityName(cityData.name);
            }
        } catch (error) {
            console.error('Weather fetch error:', error);
            this.showWeatherError(
                error.message.includes('timeout')
                    ? 'Request timeout - please check your internet connection'
                    : 'Unable to fetch weather data.'
            );
        }
    }

    async fetchWeatherFromOpenWeather(cityName, autoRefresh = false) {
        const apiKey = this.getWeatherApiKey();
        if (!apiKey) {
            this.showWeatherError('OpenWeatherMap API key required. Please add your API key in Weather settings.');
            return;
        }

        try {
            const response = await this.fetchWithTimeout(
                `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${apiKey}&units=metric`
            );

            if (!response.ok) {
                throw new Error('OpenWeatherMap API error');
            }

            const data = await response.json();
            this.updateWeatherDisplayFromOpenWeather(data, true);

            if (data.name) {
                this.saveOriginalCityName(data.name);
            }
        } catch (error) {
            console.error('OpenWeatherMap fetch error:', error);
            this.showWeatherError(
                error.message.includes('timeout')
                    ? 'Request timeout - please check your internet connection'
                    : 'Unable to fetch weather data from OpenWeatherMap. Check your API key.'
            );
        }
    }

    updateWeatherDisplayFromOpenWeather(data, shouldSave = true) {
        try {
            const temp = Math.round(data.main.temp);
            const locationName = data.sys && data.sys.country 
                ? `${data.name}, ${data.sys.country}` 
                : data.name;

            const weatherMain = data.weather[0].main.toLowerCase();
            const weatherDesc = data.weather[0].description;
            let iconClass = 'fas fa-cloud';
            let displayDesc = weatherDesc.charAt(0).toUpperCase() + weatherDesc.slice(1);

            const hour = new Date().getHours();
            const isNight = hour < 6 || hour >= 20;

            if (weatherMain === 'clear') {
                iconClass = isNight ? 'fas fa-moon' : 'fas fa-sun';
                displayDesc = isNight ? 'Clear Night' : 'Clear & Sunny';
            } else if (weatherMain === 'clouds') {
                if (weatherDesc.includes('few') || weatherDesc.includes('scattered')) {
                    iconClass = isNight ? 'fas fa-cloud-moon' : 'fas fa-cloud-sun';
                    displayDesc = 'Partly Cloudy';
                } else {
                    iconClass = 'fas fa-cloud';
                    displayDesc = 'Cloudy';
                }
            } else if (weatherMain === 'rain' || weatherMain === 'drizzle') {
                iconClass = 'fas fa-cloud-rain';
            } else if (weatherMain === 'snow') {
                iconClass = 'fas fa-snowflake';
            } else if (weatherMain === 'thunderstorm') {
                iconClass = 'fas fa-bolt';
            } else if (weatherMain === 'mist' || weatherMain === 'fog' || weatherMain === 'haze') {
                iconClass = 'fas fa-smog';
            }

            this.updateWeatherDisplay({
                main: { temp: temp },
                weather: [{ main: displayDesc }],
                name: locationName
            }, iconClass, displayDesc, shouldSave);
        } catch (error) {
            console.error('Error parsing OpenWeatherMap data:', error);
            this.showWeatherError('Error displaying weather data');
        }
    }

    getWeatherApiProvider() {
        return localStorage.getItem('weatherApiProvider') || 'openmeteo';
    }

    setWeatherApiProvider(provider) {
        localStorage.setItem('weatherApiProvider', provider);
    }

    getWeatherApiKey() {
        return localStorage.getItem('weatherApiKey') || '';
    }

    setWeatherApiKey(key) {
        localStorage.setItem('weatherApiKey', key);
    }

    showCitySelectionDropdown(cities) {
        console.log('[WEATHER] Showing city selection dropdown with', cities.length, 'cities');
        
        // Store cities data
        this.pendingCities = cities;
        this.filteredCities = [...cities];
        
        // Show dropdown
        const cityDropdown = document.getElementById('customizeCityDropdown');
        const cityDropdownList = document.getElementById('customizeCityDropdownList');
        const citySearchInput = document.getElementById('customizeCitySearchInput');
        
        console.log('[WEATHER] City dropdown element:', cityDropdown);
        console.log('[WEATHER] City dropdown list element:', cityDropdownList);
        
        if (!cityDropdown || !cityDropdownList) {
            console.error('[WEATHER] City dropdown elements not found!');
            return;
        }
        
        // Populate cities
        this.populateCityDropdown(this.filteredCities);
        
        // Show dropdown
        cityDropdown.style.display = 'block';
        console.log('[WEATHER] City dropdown display set to block');
        
        // Focus search input
        setTimeout(() => {
            if (citySearchInput) {
                citySearchInput.focus();
            }
        }, 100);
        
        // Setup event listeners if not already done
        this.setupCityDropdownListeners();
    }

    populateCityDropdown(cities) {
        const cityDropdownList = document.getElementById('customizeCityDropdownList');
        if (!cityDropdownList) {
            console.error('[WEATHER] City dropdown list not found in populateCityDropdown');
            return;
        }
        
        console.log('[WEATHER] Populating dropdown with', cities.length, 'cities');
        
        cityDropdownList.innerHTML = cities.map((city, index) => `
            <div class="city-option" data-index="${index}">
                <div class="city-name">${city.name}</div>
                <div class="city-details">
                    ${city.admin1 ? city.admin1 + ', ' : ''}${city.country}
                    ${city.country_code ? ` (${city.country_code})` : ''}
                </div>
            </div>
        `).join('');
        
        console.log('[WEATHER] City options HTML generated');
        
        // Add click listeners to city options
        const cityOptions = cityDropdownList.querySelectorAll('.city-option');
        console.log('[WEATHER] Found', cityOptions.length, 'city options to add listeners');
        cityOptions.forEach(option => {
            option.addEventListener('click', () => {
                const index = parseInt(option.dataset.index);
                const selectedCity = this.filteredCities[index];
                console.log('[WEATHER] City selected:', selectedCity.name);
                this.selectCity(selectedCity);
            });
        });
    }

    setupCityDropdownListeners() {
        if (this.cityDropdownListenersSetup) return;
        this.cityDropdownListenersSetup = true;
        
        const citySearchInput = document.getElementById('customizeCitySearchInput');
        const closeCityDropdown = document.getElementById('customizeCloseCityDropdown');
        const cityDropdown = document.getElementById('customizeCityDropdown');
        
        // Search functionality with debouncing (300ms delay)
        if (citySearchInput) {
            const debouncedSearch = this.debounce((searchTerm) => {
                this.filteredCities = this.pendingCities.filter(city => 
                    city.name.toLowerCase().includes(searchTerm) ||
                    city.country.toLowerCase().includes(searchTerm) ||
                    (city.admin1 && city.admin1.toLowerCase().includes(searchTerm))
                );
                this.populateCityDropdown(this.filteredCities);
            }, 300);

            citySearchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                debouncedSearch(searchTerm);
            });
        }
        
        // Close button
        if (closeCityDropdown) {
            closeCityDropdown.addEventListener('click', () => {
                this.closeCityDropdown();
            });
        }
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (cityDropdown && cityDropdown.style.display === 'block') {
                if (!cityDropdown.contains(e.target)) {
                    this.closeCityDropdown();
                }
            }
        });
    }

    selectCity(city) {
        // Save the weather immediately when user clicks on a city
        this.fetchWeatherForLocation(city.latitude, city.longitude, city, true);
        this.closeCityDropdown();
        
        // Update the input field in customize panel with selected city name
        const customizeWeatherLocationInput = document.getElementById('customizeWeatherLocationInput');
        if (customizeWeatherLocationInput) {
            customizeWeatherLocationInput.value = city.name;
        }
    }

    closeCityDropdown() {
        const cityDropdown = document.getElementById('customizeCityDropdown');
        const citySearchInput = document.getElementById('customizeCitySearchInput');
        
        if (cityDropdown) {
            cityDropdown.style.display = 'none';
        }
        
        if (citySearchInput) {
            citySearchInput.value = '';
        }
        
        this.pendingCities = null;
        this.filteredCities = null;
    }

    openEditPanel() {
        const editPanel = document.getElementById('editPanel');
        if (editPanel) {
            editPanel.classList.add('open');
            // Enable edit mode when panel opens
            if (!this.isEditing) {
                this.isEditing = true;
                this.enableEditMode();
            }
        }
    }

    closeEditPanel() {
        const editPanel = document.getElementById('editPanel');
        if (editPanel) {
            editPanel.classList.remove('open');
            // Disable edit mode when panel closes
            if (this.isEditing) {
                this.isEditing = false;
                this.disableEditMode();
                this.saveContent();
            }
        }
    }

    showWeatherError(message) {
        // Show error message temporarily
        const weatherLocation = document.querySelector('.weather-location');
        if (weatherLocation) {
            const originalText = weatherLocation.textContent;
            weatherLocation.textContent = message;
            weatherLocation.style.color = '#ff6b6b';
            
            setTimeout(() => {
                weatherLocation.textContent = originalText;
                weatherLocation.style.color = '';
            }, 3000);
        }
    }

    updateWeatherDisplayFromOpenMeteo(data, cityData, shouldSave = true) {
        try {
            const current = data.current_weather;
            const temp = Math.round(current.temperature);
            const weatherCode = current.weathercode;
            
            console.log('[WEATHER API] Received data:', {
                temperature: temp,
                weatherCode: weatherCode,
                cityData: cityData,
                fullData: data
            });
            
            // Format location name
            let locationName = '';
            if (typeof cityData === 'string') {
                // Legacy support for plain string
                locationName = cityData;
            } else if (cityData && cityData.name) {
                // Use city object with admin1 (state/province) if available
                locationName = cityData.admin1 
                    ? `${cityData.name}, ${cityData.admin1}` 
                    : cityData.name;
            }
            
            // Open-Meteo weather codes to icons mapping
            let iconClass = 'fas fa-cloud';
            let weatherDesc = 'Cloudy';
            
            // Check if it's nighttime (use current time, or check if API provides day/night info)
            const hour = new Date().getHours();
            const isNight = hour < 6 || hour >= 20;
            
            if (weatherCode === 0) {
                // Clear sky - show sun or moon based on time
                if (isNight) {
                    iconClass = 'fas fa-moon';
                    weatherDesc = 'Clear Night';
                } else {
                    iconClass = 'fas fa-sun';
                    weatherDesc = 'Clear & Sunny';
                }
            } else if (weatherCode >= 1 && weatherCode <= 3) {
                if (isNight) {
                    iconClass = 'fas fa-cloud-moon';
                    weatherDesc = 'Partly Cloudy';
                } else {
                    iconClass = 'fas fa-cloud-sun';
                    weatherDesc = 'Partly Cloudy';
                }
            } else if (weatherCode >= 45 && weatherCode <= 48) {
                iconClass = 'fas fa-smog';
                weatherDesc = 'Foggy';
            } else if (weatherCode >= 51 && weatherCode <= 57) {
                iconClass = 'fas fa-cloud-rain';
                weatherDesc = 'Light Rain';
            } else if (weatherCode >= 61 && weatherCode <= 67) {
                iconClass = 'fas fa-cloud-rain';
                weatherDesc = 'Rainy';
            } else if (weatherCode >= 71 && weatherCode <= 77) {
                iconClass = 'fas fa-snowflake';
                weatherDesc = 'Snowy';
            } else if (weatherCode >= 80 && weatherCode <= 82) {
                iconClass = 'fas fa-cloud-rain';
                weatherDesc = 'Heavy Rain';
            } else if (weatherCode >= 95 && weatherCode <= 99) {
                iconClass = 'fas fa-bolt';
                weatherDesc = 'Thunderstorm';
            } else {
                iconClass = 'fas fa-cloud';
                weatherDesc = 'Cloudy';
            }
            
            // Check wind speed for windy conditions
            const windSpeed = current.windspeed || 0;
            if (windSpeed > 20) {
                weatherDesc += ' & Windy';
            }
            
            this.updateWeatherDisplay({
                main: { temp: temp },
                weather: [{ main: weatherDesc }],
                name: locationName
            }, iconClass, weatherDesc, shouldSave);
        } catch (error) {
            console.error('Error parsing weather data:', error);
            this.getSimulatedWeatherForCity(typeof cityData === 'string' ? cityData : cityData.name);
        }
    }

    getSimulatedWeatherForCity(cityName) {
        // Simulated weather based on time of day
        const hour = new Date().getHours();
        const temp = Math.round(15 + Math.random() * 20); // 15-35°C
        
        let weather = 'clear';
        let icon = 'fas fa-sun';
        
        let weatherDesc = '';
        
        if (hour >= 6 && hour < 18) {
            const conditions = ['Clear & Sunny', 'Cloudy', 'Partly Cloudy'];
            weatherDesc = conditions[Math.floor(Math.random() * conditions.length)];
            
            switch(weatherDesc) {
                case 'Clear & Sunny': icon = 'fas fa-sun'; weather = 'clear'; break;
                case 'Cloudy': icon = 'fas fa-cloud'; weather = 'clouds'; break;
                case 'Partly Cloudy': icon = 'fas fa-cloud-sun'; weather = 'clouds'; break;
            }
        } else {
            const conditions = ['Clear Night', 'Cloudy Night'];
            weatherDesc = conditions[Math.floor(Math.random() * conditions.length)];
            weather = weatherDesc === 'Clear Night' ? 'clear' : 'clouds';
            icon = weather === 'clear' ? 'fas fa-moon' : 'fas fa-cloud';
        }
        
        this.updateWeatherDisplay({
            main: { temp: temp },
            weather: [{ main: weather }],
            name: cityName
        }, icon, weatherDesc, false);
    }

    getCityFromCoords(lat, lon) {
        // Simple city detection based on coordinates (very basic)
        const cities = [
            { name: 'New York', lat: 40.7128, lon: -74.0060 },
            { name: 'London', lat: 51.5074, lon: -0.1278 },
            { name: 'Paris', lat: 48.8566, lon: 2.3522 },
            { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
            { name: 'Sydney', lat: -33.8688, lon: 151.2093 }
        ];
        
        let closest = cities[0];
        let minDistance = this.calculateDistance(lat, lon, closest.lat, closest.lon);
        
        for (let city of cities) {
            const distance = this.calculateDistance(lat, lon, city.lat, city.lon);
            if (distance < minDistance) {
                minDistance = distance;
                closest = city;
            }
        }
        
        return closest.name;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    setDefaultWeather() {
        const temp = Math.round(20 + Math.random() * 10); // 20-30°C
        const hour = new Date().getHours();
        const isDay = hour >= 6 && hour < 18;
        
        // Use shouldSave = false to prevent saving default location
        this.updateWeatherDisplay({
            main: { temp: temp },
            weather: [{ main: isDay ? 'Clear' : 'Clear' }],
            name: 'Your City'
        }, isDay ? 'fas fa-sun' : 'fas fa-moon', null, false);
    }

    updateWeatherDisplay(data, customIcon = null, weatherDesc = null, shouldSave = true) {
        const tempElement = document.getElementById('weatherTemp');
        const iconElement = document.getElementById('weatherIcon');
        const locationElement = document.getElementById('weatherLocation');
        const descElement = document.getElementById('weatherDesc');
        
        this.log('updateWeatherDisplay called with:', { data, customIcon, weatherDesc, shouldSave });
        
        if (tempElement) {
            tempElement.textContent = Math.round(data.main.temp) + '°C';
        }
        
        // Update weather description
        if (descElement) {
            if (weatherDesc) {
                descElement.textContent = weatherDesc;
            } else if (data.weather && data.weather[0]) {
                const weatherMain = data.weather[0].main.toLowerCase();
                let description = '';
                
                switch (weatherMain) {
                    case 'clear': description = 'Clear & Sunny'; break;
                    case 'clouds': description = 'Cloudy'; break;
                    case 'rain': description = 'Rainy'; break;
                    case 'snow': description = 'Snowy'; break;
                    case 'thunderstorm': description = 'Thunderstorm'; break;
                    case 'drizzle': description = 'Light Rain'; break;
                    case 'mist': 
                    case 'fog': description = 'Foggy'; break;
                    default: description = 'Cloudy';
                }
                descElement.textContent = description;
            }
        }
        
        if (iconElement && customIcon) {
            iconElement.innerHTML = `<i class="${customIcon}"></i>`;
        } else if (iconElement && data.weather && data.weather[0]) {
            const weatherMain = data.weather[0].main.toLowerCase();
            let iconClass = 'fas fa-cloud';
            
            switch (weatherMain) {
                case 'clear': iconClass = 'fas fa-sun'; break;
                case 'clouds': iconClass = 'fas fa-cloud'; break;
                case 'rain': iconClass = 'fas fa-cloud-rain'; break;
                case 'snow': iconClass = 'fas fa-snowflake'; break;
                case 'thunderstorm': iconClass = 'fas fa-bolt'; break;
                default: iconClass = 'fas fa-cloud';
            }
            
            iconElement.innerHTML = `<i class="${iconClass}"></i>`;
        }
        
        if (locationElement && data.name) {
            locationElement.textContent = data.name;
            // Save the weather location only if shouldSave is true
            if (shouldSave) {
                this.saveWeatherLocation(data.name);
            }
        }
        
        // Save complete weather data for restoration on page load only if shouldSave is true
        if (shouldSave) {
            this.saveCompleteWeatherData(data, customIcon, weatherDesc);
        }
        
        // If weather theme is active, reapply it with new weather data
        const savedTheme = localStorage.getItem('selectedTheme');
        if (savedTheme === 'weather') {
            setTimeout(() => this.applyWeatherTheme(), 100);
        }
    }

    saveWeatherLocation(cityName) {
        try {
            const savedContent = localStorage.getItem('newTabContent');
            let content = savedContent ? JSON.parse(savedContent) : {};
            content.weatherLocation = cityName;
            localStorage.setItem('newTabContent', JSON.stringify(content));
        } catch (error) {
            console.error('Error saving weather location:', error);
        }
    }

    saveOriginalCityName(cityName) {
        try {
            const savedContent = localStorage.getItem('newTabContent');
            let content = savedContent ? JSON.parse(savedContent) : {};
            content.originalCityName = cityName;
            localStorage.setItem('newTabContent', JSON.stringify(content));
        } catch (error) {
            console.error('Error saving original city name:', error);
        }
    }

    saveCompleteWeatherData(data, customIcon, weatherDesc) {
        try {
            const savedContent = localStorage.getItem('newTabContent');
            let content = savedContent ? JSON.parse(savedContent) : {};
            content.savedWeatherData = {
                data: data,
                customIcon: customIcon,
                weatherDesc: weatherDesc,
                timestamp: Date.now()
            };
            localStorage.setItem('newTabContent', JSON.stringify(content));
            this.log('Saved weather data:', content.savedWeatherData);
        } catch (error) {
            console.error('Error saving weather data:', error);
        }
    }

    restoreSavedWeather(savedWeatherData) {
        try {
            const tempElement = document.getElementById('weatherTemp');
            const iconElement = document.getElementById('weatherIcon');
            const locationElement = document.getElementById('weatherLocation');
            const descElement = document.getElementById('weatherDesc');
            
            const data = savedWeatherData.data;
            const customIcon = savedWeatherData.customIcon;
            const weatherDesc = savedWeatherData.weatherDesc;
            
            this.log('Restoring weather - temp:', data.main?.temp, 'desc:', weatherDesc, 'icon:', customIcon, 'location:', data.name);
            
            if (tempElement && data.main) {
                tempElement.textContent = Math.round(data.main.temp) + '°C';
            }
            
            if (descElement && weatherDesc) {
                descElement.textContent = weatherDesc;
            }
            
            if (iconElement && customIcon) {
                iconElement.innerHTML = `<i class="${customIcon}"></i>`;
            }
            
            if (locationElement && data.name) {
                locationElement.textContent = data.name;
            }
            
            this.log('Weather restored successfully');
        } catch (error) {
            console.error('Error restoring weather:', error);
            // Fall back to default weather without fetching
            this.setDefaultWeather();
        }
    }

    getOriginalCityName() {
        try {
            const savedContent = localStorage.getItem('newTabContent');
            if (savedContent) {
                const content = JSON.parse(savedContent);
                return content.originalCityName || content.weatherLocation || '';
            }
        } catch (error) {
            console.error('Error getting original city name:', error);
        }
        return '';
    }

    setupWeatherRefresh() {
        // Clear existing timer
        if (this.weatherRefreshTimer) {
            clearInterval(this.weatherRefreshTimer);
            this.weatherRefreshTimer = null;
        }

        // Load saved refresh interval
        const savedInterval = this.loadWeatherRefreshInterval();
        this.weatherRefreshInterval = savedInterval;

        // Update the select element
        const weatherRefreshSelect = document.getElementById('weatherRefreshInterval');
        if (weatherRefreshSelect) {
            weatherRefreshSelect.value = this.weatherRefreshInterval;
        }

        // Set up auto-refresh if interval > 0
        if (this.weatherRefreshInterval > 0) {
            const intervalMs = this.weatherRefreshInterval * 60 * 1000; // Convert minutes to milliseconds
            this.weatherRefreshTimer = setInterval(() => {
                this.refreshWeatherData();
            }, intervalMs);
            this.log(`Weather auto-refresh enabled: every ${this.weatherRefreshInterval} minutes`);
        } else {
            this.log('Weather auto-refresh disabled');
        }
    }

    async refreshWeatherData() {
        const originalCity = this.getOriginalCityName();
        if (originalCity && originalCity !== 'Your City' && originalCity !== 'Loading...') {
            this.log('Auto-refreshing weather for:', originalCity);
            await this.fetchWeatherByCity(originalCity, true);
        }
    }

    saveWeatherRefreshInterval(interval) {
        try {
            const savedContent = localStorage.getItem('newTabContent');
            let content = savedContent ? JSON.parse(savedContent) : {};
            content.weatherRefreshInterval = interval;
            localStorage.setItem('newTabContent', JSON.stringify(content));
        } catch (error) {
            console.error('Error saving weather refresh interval:', error);
        }
    }

    loadWeatherRefreshInterval() {
        try {
            const savedContent = localStorage.getItem('newTabContent');
            if (savedContent) {
                const content = JSON.parse(savedContent);
                return content.weatherRefreshInterval !== undefined ? content.weatherRefreshInterval : 30;
            }
        } catch (error) {
            console.error('Error loading weather refresh interval:', error);
        }
        return 30; // Default: 30 minutes
    }

    performSearch(engine = null) {
        const searchInput = document.getElementById('searchInput');
        const query = searchInput.value.trim();
        
        if (query) {
            const targetEngine = engine || this.currentSearchEngine;
            const engineData = this.searchEngines[targetEngine];
            const searchUrl = engineData.url + encodeURIComponent(query);
            window.open(searchUrl, '_blank');
            
            searchInput.value = '';
        }
    }

    switchSearchEngine(engine) {
        this.currentSearchEngine = engine;
        
        // Update active tab
        document.querySelectorAll('.search-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-engine="${engine}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        // Update placeholder
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.placeholder = this.searchEngines[engine].placeholder;
        }
    }

    addLink() {
        this.log('Add link button clicked'); // Debug log
        
        const linksGrid = document.getElementById('linksGrid');
        if (!linksGrid) {
            console.error('Links grid not found');
            alert('Error: Could not find links container');
            return;
        }

        // Check if we already have 12 links (3 rows × 4 columns)
        const existingLinks = linksGrid.querySelectorAll('.link-item').length;
        if (existingLinks >= 12) {
            alert('Maximum of 12 Quick Links allowed to keep everything on screen without scrolling.');
            return;
        }
        
        try {
            // Ask user what type of link they want to add
            const linkType = prompt('What type of link?\n\n1. Website URL\n2. Windows/Mac App\n\nEnter 1 or 2:');
            
            if (!linkType || (linkType.trim() !== '1' && linkType.trim() !== '2')) {
                this.log('User cancelled or entered invalid option');
                return;
            }
            
            let validUrl;
            
            if (linkType.trim() === '2') {
                // App protocol link
                const appInfo = prompt('Enter app protocol or path\n\nExamples:\n- whatsapp://\n- ms-settings:\n- steam://\n- spotify:\n- C:\\Program Files\\App\\app.exe (Windows)\n- /Applications/App.app (Mac)');
                
                if (!appInfo || appInfo.trim() === '') {
                    this.log('User cancelled or entered empty app info');
                    return;
                }
                
                validUrl = appInfo.trim();
                
                // If it looks like a file path, convert to app:// protocol
                if (validUrl.includes('\\') || validUrl.includes('/Applications/')) {
                    // Keep as-is for now, browser will handle it
                    validUrl = 'file:///' + validUrl.replace(/\\/g, '/');
                }
            } else {
                // Website URL
                const url = prompt('Enter URL (e.g., example.com or https://example.com):');
                if (!url || url.trim() === '') {
                    this.log('User cancelled or entered empty URL');
                    return;
                }
                
                // Validate and format URL
                validUrl = url.trim();
                if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
                    validUrl = 'https://' + validUrl;
                }
            }
            
            // Get name
            const name = prompt('Enter link name:');
            if (!name || name.trim() === '') {
                this.log('User cancelled or entered empty name');
                return;
            }
            
            // Get icon
            let icon = prompt('Enter Font Awesome icon class (e.g., fab fa-google, fas fa-globe, fab fa-whatsapp):');
            if (!icon || icon.trim() === '') {
                icon = linkType.trim() === '2' ? 'fas fa-desktop' : 'fas fa-link';
            }
            
            this.log('Creating link with:', { validUrl, name: name.trim(), icon });
            
            // Create the link using the helper method
            this.createAndAddLinkElement(linksGrid, validUrl, name.trim(), icon);
            
            // Update grid layout based on number of links
            this.updateGridLayout();
            
            // Save immediately
            this.saveContent();
            
            // Update the customize panel links list
            this.populateLinksManager();
            
            this.log('Link added successfully');
            
        } catch (error) {
            console.error('Error in addLink:', error);
            alert('Error adding link: ' + error.message);
        }
    }

    createAndAddLinkElementDirect(container, url, name, icon) {
        // Direct version - always adds to the specified container
        const newLink = this.createLinkStructure(url, name, icon);
        container.appendChild(newLink);
        return newLink;
    }

    createLinkStructure(url, name, icon) {
        // Create new link element
        const newLink = document.createElement('div');
        newLink.className = 'link-item';
        
        // Create the HTML structure
        const linkCard = document.createElement('a');
        linkCard.href = url;
        // Don't open in new tab - open in same window
        linkCard.className = 'link-card';
        
        const iconElement = document.createElement('i');
        iconElement.className = icon + ' link-icon';
        
        const nameElement = document.createElement('span');
        nameElement.className = 'link-name editable';
        nameElement.contentEditable = 'false';
        nameElement.setAttribute('data-placeholder', 'Link Name');
        nameElement.textContent = name;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.style.display = 'none';
        
        // Assemble the structure
        linkCard.appendChild(iconElement);
        linkCard.appendChild(nameElement);
        newLink.appendChild(linkCard);
        newLink.appendChild(removeBtn);
        
        // Set positioning
        newLink.style.position = 'relative';
        
        // Add event listeners
        const handleRemove = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.log('Removing link:', name);
            newLink.remove();
            this.updateGridLayout();
            this.saveContent();
        };
        
        const handleMouseEnter = () => {
            if (this.isEditing) {
                removeBtn.style.display = 'block';
            }
        };
        
        const handleMouseLeave = () => {
            removeBtn.style.display = 'none';
        };
        
        // Bind event listeners
        removeBtn.addEventListener('click', handleRemove);
        newLink.addEventListener('mouseenter', handleMouseEnter);
        newLink.addEventListener('mouseleave', handleMouseLeave);
        
        return newLink;
    }

    createAndAddLinkElement(container, url, name, icon) {
        const newLink = this.createLinkStructure(url, name, icon);
        
        // Add to the appropriate container
        // If adding to the old grid, actually add to quicklinks widget instead
        const quicklinksContent = document.getElementById('quicklinksContent');
        if (quicklinksContent && container.id === 'linksGrid') {
            // Add directly to quicklinks widget, not the old grid
            quicklinksContent.appendChild(newLink);
        } else {
            // For other containers, add normally
            container.appendChild(newLink);
        }
        
        return newLink;
    }

    saveContent() {
        try {
            const greetingEl = document.getElementById('greeting');
            const linksTitleEl = document.querySelector('.links-title');
            const weatherLocationEl = document.querySelector('.weather-location');
            
            // Get existing saved content to preserve weather data
            const savedContent = localStorage.getItem('newTabContent');
            let existingData = savedContent ? JSON.parse(savedContent) : {};
            
            // Get links from quicklinks widget content if it exists, otherwise from old grid
            const quicklinksContent = document.getElementById('quicklinksContent');
            const linkContainer = quicklinksContent || document.getElementById('linksGrid');
            const linkItems = linkContainer ? linkContainer.querySelectorAll('.link-item') : [];
            
            const content = {
                ...existingData, // Preserve existing data like savedWeatherData, originalCityName
                // greeting is NOT saved - always based on time, season, and weather
                linksTitle: linksTitleEl ? linksTitleEl.textContent : 'Quick Links',
                weatherLocation: weatherLocationEl ? weatherLocationEl.textContent : 'Your City',
                links: Array.from(linkItems).map(item => {
                    const link = item.querySelector('.link-card');
                    const nameEl = link.querySelector('.link-name');
                    const iconEl = link.querySelector('.link-icon');
                    // Get icon classes and remove 'link-icon' (that's the CSS class, not the icon itself)
                    let iconClass = iconEl ? iconEl.className : 'fas fa-link';
                    iconClass = iconClass.split(' ').filter(c => c !== 'link-icon').join(' ').trim();
                    if (!iconClass) iconClass = 'fas fa-link';
                    return {
                        url: link.href || '#',
                        name: nameEl ? nameEl.textContent : 'Link',
                        icon: iconClass
                    };
                })
            };

            // Save to localStorage
            localStorage.setItem('newTabContent', JSON.stringify(content));
            
            // Don't show notification on auto-save to avoid annoying the user
            // this.showSaveNotification();
        } catch (error) {
            console.error('Error saving content:', error);
        }
    }

    loadSavedContent() {
        const savedContent = localStorage.getItem('newTabContent');
        if (!savedContent) return;

        try {
            const content = JSON.parse(savedContent);
            
            // DON'T load greeting - always dynamically set based on time/season/weather
            // Greeting is generated fresh on each page load by setGreeting()
            
            // Load links title
            const linksTitleEl = document.querySelector('.links-title');
            if (content.linksTitle && linksTitleEl) {
                linksTitleEl.textContent = content.linksTitle;
            }
            
            // Load weather location (only if user has customized it)
            const weatherLocationEl = document.getElementById('weatherLocation');
            if (content.weatherLocation && weatherLocationEl && 
                content.weatherLocation !== 'Loading...' && 
                content.weatherLocation !== 'Your City' &&
                content.weatherLocation !== 'New York') {
                weatherLocationEl.textContent = content.weatherLocation;
            }
            
            // Load ALL links (replace default links with saved ones)
            if (content.links && content.links.length > 0) {
                const linksGrid = document.getElementById('linksGrid');
                if (linksGrid) {
                    // Clear all existing links
                    linksGrid.innerHTML = '';
                    
                    // Add all saved links to linksGrid (they'll be moved to widget later)
                    content.links.forEach(linkData => {
                        // Create element but add to linksGrid temporarily
                        const linkEl = this.createAndAddLinkElementDirect(linksGrid, linkData.url, linkData.name, linkData.icon);
                    });
                    
                    // Update grid layout
                    this.updateGridLayout();
                }
            }
            
        } catch (error) {
            console.error('Error loading saved content:', error);
        }
    }

    createLinkElement(container, url, name, icon) {
        return this.createAndAddLinkElement(container, url, name, icon);
    }

    changeWeatherCity() {
        // Open profile panel and switch to customize tab
        this.openProfilePanel();
        
        setTimeout(() => {
            // Switch to customize tab
            this.switchProfileTab('customize');
            
            // Focus on weather input after a short delay to ensure tab is loaded
            setTimeout(() => {
                const weatherLocationInput = document.getElementById('customizeWeatherLocationInput');
                if (weatherLocationInput) {
                    // Get original city name (not the display name with state)
                    const originalCity = this.getOriginalCityName();
                    if (originalCity && originalCity !== 'Loading...' && originalCity !== 'Your City') {
                        weatherLocationInput.value = originalCity;
                    }
                    weatherLocationInput.focus();
                    weatherLocationInput.select();
                }
            }, 100);
        }, 100);
    }

    setupAutoSave() {
        // Setup auto-save listeners for initial elements
        this.setupAutoSaveListeners();

        // Auto-save every 30 seconds when editing
        setInterval(() => {
            if (this.isEditing) {
                this.saveContent();
            }
        }, 30000);
    }

    showSaveNotification() {
        this.saveNotification.classList.add('show');
        
        setTimeout(() => {
            this.saveNotification.classList.remove('show');
        }, 2000);
    }

    setupDefaultLinkRemoval() {
        const removeButtons = document.querySelectorAll('.remove-btn');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.isEditing) {
                    const linkItem = btn.closest('.link-item');
                    if (linkItem) {
                        linkItem.remove();
                        this.updateGridLayout();
                        this.saveContent();
                    }
                }
            });
        });
    }

    changeTheme(themeName, saveToProfile = true) {
        // Remove existing theme classes
        const themes = ['theme-ocean', 'theme-sunset', 'theme-forest', 'theme-purple', 'theme-rose', 'theme-dark', 'theme-midnight', 'theme-charcoal', 'theme-navy', 'theme-steel', 'theme-cobalt', 'theme-arctic', 'theme-weather', 'theme-weather-dark'];
        themes.forEach(theme => document.body.classList.remove(theme));
        
        // Remove inline weather theme styles to allow CSS themes to work
        document.body.style.background = '';
        
        // Store current theme
        this.currentTheme = themeName;
        
        // Handle weather-based theme
        if (themeName === 'weather' || themeName === 'weather-dark') {
            // Auto-enable weather effects and elements for dynamic weather themes
            this.weatherEffectsEnabled = true;
            this.weatherCloudsEnabled = true;
            localStorage.setItem('weatherEffectsEnabled', 'true');
            localStorage.setItem('weatherCloudsEnabled', 'true');
            
            // Update checkboxes if they exist
            const weatherEffectsToggle = document.getElementById('customizeWeatherEffectsToggle');
            const weatherCloudsToggle = document.getElementById('customizeWeatherCloudsToggle');
            if (weatherEffectsToggle) weatherEffectsToggle.checked = true;
            if (weatherCloudsToggle) weatherCloudsToggle.checked = true;
            
            // Apply weather theme with effects
            this.removeWeatherEffects();
            this.applyWeatherTheme(themeName === 'weather-dark');
            localStorage.setItem('selectedTheme', themeName);
            return;
        }
        
        // For non-weather themes, keep user's weather effects preference
        // Don't auto-disable - let user control via checkboxes
        if (this.weatherEffectsEnabled) {
            // Apply weather effects if enabled
            this.applyWeatherEffectsOnly();
        } else {
            // Remove weather effects if disabled
            this.removeWeatherEffects();
        }
        
        // Add new theme class
        if (themeName !== 'ocean') {
            document.body.classList.add(`theme-${themeName}`);
        }
        
        // Save theme preference
        localStorage.setItem('selectedTheme', themeName);
        
        // Only update user profile if saveToProfile is true (user manually changed it)
        if (saveToProfile && this.userProfileManager && this.userProfileManager.isUserLoggedIn()) {
            const user = this.userProfileManager.getCurrentUser();
            if (user && user.preferences) {
                user.preferences.theme = themeName;
                // Save the updated profile with password
                this.userProfileManager.getDecryptionPassword().then(password => {
                    if (password) {
                        this.userProfileManager.saveUserProfile(user.username, user, password);
                    }
                }).catch(err => {
                    console.error('Failed to save theme to profile:', err);
                });
            }
        }
        
        this.updateThemeColors();
    }

    async applyWeatherTheme(darkMode = false, gradientOnly = false) {
        // Get current weather condition from the weather widget
        const weatherDesc = document.getElementById('weatherDesc')?.textContent?.toLowerCase() || '';
        const weatherTemp = document.getElementById('weatherTemp')?.textContent || '';
        const temp = parseInt(weatherTemp);
        const hour = new Date().getHours();
        const isDay = hour >= 6 && hour < 18;
        const isEvening = hour >= 18 && hour < 21;
        const isNight = hour >= 21 || hour < 6;
        const isMorning = hour >= 6 && hour < 10;
        
        let gradient = '';
        let glassOpacity = 0.15;
        
        this.log(`Applying weather theme - Condition: ${weatherDesc}, Temp: ${temp}°C, Time: ${hour}:00 (${isDay ? 'Day' : 'Night'}), Dark Mode: ${darkMode}`);
        
        // CLEAR & SUNNY CONDITIONS
        if (weatherDesc.includes('clear') || weatherDesc.includes('sunny')) {
            if (isNight) {
                // Clear night - deep blue/purple with stars
                gradient = darkMode 
                    ? 'linear-gradient(135deg, #000000 0%, #1a1a2e 50%, #16213e 100%)'
                    : 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)';
                glassOpacity = darkMode ? 0.08 : 0.12;
            } else if (isMorning) {
                // Clear morning - soft sunrise colors
                gradient = darkMode
                    ? (temp > 20 
                        ? 'linear-gradient(135deg, #2d2d2d 0%, #3d3d3d 50%, #4d4d4d 100%)'
                        : 'linear-gradient(135deg, #1e2a3a 0%, #2a3a4a 50%, #3a4a5a 100%)')
                    : (temp > 20 
                        ? 'linear-gradient(135deg, #FFB75E 0%, #ED8F03 50%, #f6d365 100%)'
                        : 'linear-gradient(135deg, #a8edea 0%, #fed6e3 50%, #f093fb 100%)');
            } else if (isEvening) {
                // Clear evening - sunset colors
                gradient = darkMode
                    ? 'linear-gradient(135deg, #2d1b2e 0%, #3d2b3e 50%, #4d3b4e 100%)'
                    : 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 50%, #ee9ca7 100%)';
                glassOpacity = darkMode ? 0.12 : 0.18;
            } else {
                // Clear day - bright sky based on temperature
                if (darkMode) {
                    gradient = 'linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #4a5f7f 100%)';
                } else {
                    if (temp > 30) {
                        gradient = 'linear-gradient(135deg, #f46b45 0%, #eea849 50%, #f9d423 100%)'; // Hot
                    } else if (temp > 20) {
                        gradient = 'linear-gradient(135deg, #56CCF2 0%, #2F80ED 50%, #667eea 100%)'; // Warm
                    } else {
                        gradient = 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 50%, #4facfe 100%)'; // Cool
                    }
                }
            }
        }
        
        // PARTLY CLOUDY CONDITIONS
        else if (weatherDesc.includes('partly')) {
            if (isNight) {
                gradient = darkMode
                    ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)'
                    : 'linear-gradient(135deg, #232526 0%, #414345 50%, #536976 100%)';
            } else if (isEvening) {
                gradient = darkMode
                    ? 'linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 50%, #3a3a4e 100%)'
                    : 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 50%, #a770ef 100%)';
            } else {
                gradient = darkMode
                    ? 'linear-gradient(135deg, #34495e 0%, #2c3e50 50%, #536976 100%)'
                    : (temp > 25
                        ? 'linear-gradient(135deg, #89CFF0 0%, #7BA8D1 50%, #6A8FB2 100%)'
                        : 'linear-gradient(135deg, #7FA1C3 0%, #6D89A5 50%, #5B7187 100%)');
            }
            glassOpacity = darkMode ? 0.12 : 0.16;
        }
        
        // CLOUDY CONDITIONS
        else if (weatherDesc.includes('cloud')) {
            if (isNight) {
                gradient = darkMode
                    ? 'linear-gradient(135deg, #0f0f0f 0%, #1f1f1f 50%, #2f2f2f 100%)'
                    : 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #3a6ea5 100%)';
            } else {
                gradient = darkMode
                    ? 'linear-gradient(135deg, #2f3640 0%, #3d4654 50%, #4b5668 100%)'
                    : (temp > 25
                        ? 'linear-gradient(135deg, #95A5A6 0%, #B3B6B7 50%, #CED4DA 100%)'
                        : 'linear-gradient(135deg, #7F8C8D 0%, #95A5A6 50%, #AAB7B8 100%)');
            }
            glassOpacity = darkMode ? 0.15 : 0.2;
        }
        
        // RAINY CONDITIONS
        else if (weatherDesc.includes('rain') || weatherDesc.includes('drizzle')) {
            if (weatherDesc.includes('heavy')) {
                gradient = darkMode
                    ? 'linear-gradient(135deg, #000000 0%, #0a0a0a 50%, #1a1a1a 100%)'
                    : 'linear-gradient(135deg, #141E30 0%, #243B55 50%, #34495e 100%)';
            } else if (weatherDesc.includes('light')) {
                gradient = darkMode
                    ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #3f5971 100%)'
                    : 'linear-gradient(135deg, #7F8C8D 0%, #95A5A6 50%, #BDC3C7 100%)';
            } else {
                gradient = darkMode
                    ? 'linear-gradient(135deg, #1a252f 0%, #2c3e50 50%, #3d5a73 100%)'
                    : 'linear-gradient(135deg, #2C3E50 0%, #4CA1AF 50%, #546E7A 100%)';
            }
            glassOpacity = darkMode ? 0.18 : 0.22;
        }
        
        // THUNDERSTORM CONDITIONS
        else if (weatherDesc.includes('thunder') || weatherDesc.includes('storm')) {
            gradient = darkMode
                ? 'linear-gradient(135deg, #000000 0%, #0a0a14 50%, #14141e 100%)'
                : 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)';
            glassOpacity = darkMode ? 0.2 : 0.25;
        }
        
        // SNOWY CONDITIONS
        else if (weatherDesc.includes('snow')) {
            if (isNight) {
                gradient = darkMode
                    ? 'linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 50%, #3a3a4e 100%)'
                    : 'linear-gradient(135deg, #e6dada 0%, #274046 50%, #3a5a6d 100%)';
            } else {
                gradient = darkMode
                    ? 'linear-gradient(135deg, #4a5568 0%, #5a6578 50%, #6a7588 100%)'
                    : 'linear-gradient(135deg, #E0EAFC 0%, #CFDEF3 50%, #D4E7FE 100%)';
            }
            glassOpacity = darkMode ? 0.2 : 0.25;
        }
        
        // FOGGY/MISTY CONDITIONS
        else if (weatherDesc.includes('fog') || weatherDesc.includes('mist') || weatherDesc.includes('smog')) {
            gradient = darkMode
                ? 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #3a3a3a 100%)'
                : (isNight
                    ? 'linear-gradient(135deg, #434343 0%, #000000 50%, #2d2d2d 100%)'
                    : 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 50%, #7f8c8d 100%)');
            glassOpacity = darkMode ? 0.25 : 0.28;
        }
        
        // WINDY CONDITIONS - modify existing gradient
        else if (weatherDesc.includes('windy')) {
            gradient = darkMode
                ? 'linear-gradient(135deg, #2c3e50 0%, #3a5062 50%, #486274 100%)'
                : 'linear-gradient(135deg, #348F50 0%, #56B4D3 50%, #4facfe 100%)';
            glassOpacity = darkMode ? 0.15 : 0.18;
        }
        
        // DEFAULT FALLBACK
        else {
            gradient = darkMode
                ? (isNight
                    ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)'
                    : 'linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #4a5f7f 100%)')
                : (isNight
                    ? 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #667eea 100%)'
                    : 'linear-gradient(135deg, #56CCF2 0%, #2F80ED 50%, #667eea 100%)');
        }
        
        // Apply the dynamic gradient and glass effect
        document.body.style.background = gradient;
        document.documentElement.style.setProperty('--glass-bg', `rgba(255, 255, 255, ${glassOpacity})`);
        document.documentElement.style.setProperty('--glass-border', `rgba(255, 255, 255, ${glassOpacity + 0.05})`);
        
        document.body.classList.add(darkMode ? 'theme-weather-dark' : 'theme-weather'); // Mark as weather-based
        this.updateThemeColors();
        
        // Apply weather visual effects only if not gradient-only mode
        if (!gradientOnly) {
            this.applyWeatherEffects(weatherDesc, temp, isDay, isNight);
        }
        
        this.log(`✓ Applied ${darkMode ? 'dark' : 'light'} dynamic weather theme ${gradientOnly ? '(gradient only)' : 'with effects'} - Gradient: ${gradient.substring(0, 50)}...`);
    }

    applyWeatherEffects(weatherDesc, temp, isDay, isNight) {
        // Remove existing weather effects
        const existingEffects = document.querySelector('.weather-effects');
        if (existingEffects) {
            existingEffects.remove();
        }

        // Create weather effects container
        const effectsContainer = document.createElement('div');
        effectsContainer.className = 'weather-effects';
        document.body.appendChild(effectsContainer);

        // WEATHER EFFECTS - Only if weatherEffectsEnabled is true
        if (this.weatherEffectsEnabled) {
            // RAIN EFFECTS
            if (weatherDesc.includes('rain') || weatherDesc.includes('drizzle')) {
                const rainCount = weatherDesc.includes('heavy') ? 150 : weatherDesc.includes('light') ? 50 : 100;
                const rainClass = weatherDesc.includes('heavy') ? 'rain heavy-rain' : 'rain';
                
                for (let i = 0; i < rainCount; i++) {
                    const rain = document.createElement('div');
                    rain.className = rainClass;
                    rain.style.left = Math.random() * 100 + '%';
                    rain.style.animationDuration = (Math.random() * 0.5 + 0.5) + 's';
                    rain.style.animationDelay = Math.random() * 2 + 's';
                    effectsContainer.appendChild(rain);
                }
            }

            // THUNDERSTORM EFFECTS
            if (weatherDesc.includes('thunder') || weatherDesc.includes('storm')) {
                // Add rain for thunderstorm
                for (let i = 0; i < 120; i++) {
                    const rain = document.createElement('div');
                    rain.className = 'rain heavy-rain';
                    rain.style.left = Math.random() * 100 + '%';
                    rain.style.animationDuration = (Math.random() * 0.3 + 0.4) + 's';
                    rain.style.animationDelay = Math.random() * 2 + 's';
                    effectsContainer.appendChild(rain);
                }

                // Add lightning flash effect
                const lightning = document.createElement('div');
                lightning.className = 'lightning-flash';
                document.body.appendChild(lightning);

                // Random lightning flashes
                const flashLightning = () => {
                    lightning.classList.add('flash');
                    setTimeout(() => {
                        lightning.classList.remove('flash');
                    }, 300);
                };

                // Flash every 3-8 seconds
                setInterval(() => {
                    if (Math.random() > 0.3) { // 70% chance
                        flashLightning();
                        // Sometimes double flash
                        if (Math.random() > 0.7) {
                            setTimeout(flashLightning, 500);
                        }
                    }
                }, (Math.random() * 5000 + 3000));
            }

            // SNOW EFFECTS
            if (weatherDesc.includes('snow')) {
                const snowCount = 80;
                
                for (let i = 0; i < snowCount; i++) {
                    const snow = document.createElement('div');
                    snow.className = 'snow';
                    snow.style.left = Math.random() * 100 + '%';
                    snow.style.width = (Math.random() * 6 + 4) + 'px';
                    snow.style.height = snow.style.width;
                    snow.style.animationDuration = (Math.random() * 5 + 5) + 's';
                    snow.style.animationDelay = Math.random() * 5 + 's';
                    effectsContainer.appendChild(snow);
                }
            }

            // FOG/MIST EFFECTS
            if (weatherDesc.includes('fog') || weatherDesc.includes('mist') || weatherDesc.includes('smog')) {
                for (let i = 0; i < 3; i++) {
                    const fog = document.createElement('div');
                    fog.className = 'fog';
                    fog.style.top = (i * 30) + '%';
                    fog.style.animationDelay = (i * 5) + 's';
                    fog.style.opacity = 0.3 + (Math.random() * 0.3);
                    effectsContainer.appendChild(fog);
                }
            }
        }

        // WEATHER ELEMENTS (CLOUDS) - Independent from effects checkbox
        // CLOUDS EFFECT (for partly cloudy, cloudy, and ALL RAIN conditions)
        if (this.weatherCloudsEnabled && (weatherDesc.includes('partly') || weatherDesc.includes('cloud') || 
            weatherDesc.includes('rain') || weatherDesc.includes('drizzle') || weatherDesc.includes('thunderstorm'))) {
            
            const isRaining = weatherDesc.includes('rain') || weatherDesc.includes('drizzle') || weatherDesc.includes('thunderstorm');
            const isHeavyRain = weatherDesc.includes('heavy');
            const isPartlyCloudy = weatherDesc.includes('partly');
            const isFullyCloudy = !isPartlyCloudy && weatherDesc.includes('cloud');
            
            // Determine cloud type and color
            let cloudClass = '';
            if (isRaining) {
                cloudClass = 'rain-cloud'; // Dark gray for rain
            } else if (isFullyCloudy) {
                cloudClass = 'full-cloud'; // Super dark gray for fully cloudy
            } else if (isPartlyCloudy) {
                cloudClass = 'partly-cloud'; // Light gray for partly cloudy
            }
            
            // Use heavy cloud images for heavy rain and very cloudy conditions
            const useHeavyClouds = isHeavyRain || (isFullyCloudy && !isPartlyCloudy);
            
            if (useHeavyClouds) {
                // Create heavy cloud layers with background images
                for (let i = 1; i <= 3; i++) {
                    const cloudLayer = document.createElement('div');
                    cloudLayer.className = `heavy-clouds heavy-clouds-${i} ${cloudClass}`;
                    effectsContainer.appendChild(cloudLayer);
                }
            } else {
                // Regular clouds
                let cloudCount;
                if (isRaining) {
                    cloudCount = 10; // Lots of clouds when raining!
                } else if (isFullyCloudy) {
                    cloudCount = 5; // Several clouds for fully cloudy
                } else {
                    cloudCount = 3; // Fewer for partly cloudy
                }
                
                for (let i = 0; i < cloudCount; i++) {
                    const wrapper = document.createElement('div');
                    wrapper.className = `x${(i % 5) + 1} ${cloudClass}`.trim();
                    
                    // Randomize vertical position to spread clouds out
                    wrapper.style.top = (Math.random() * 40) + '%';
                    
                    // Add random delay to spread clouds horizontally
                    wrapper.style.animationDelay = `-${Math.random() * 30}s`;
                    
                    const cloud = document.createElement('div');
                    cloud.className = 'cloud';
                    
                    wrapper.appendChild(cloud);
                    effectsContainer.appendChild(wrapper);
                }
            }
        }

        // MORE WEATHER EFFECTS - Only if weatherEffectsEnabled is true
        if (this.weatherEffectsEnabled) {
            // STARS EFFECT (for clear nights)
            if ((weatherDesc.includes('clear') || weatherDesc.includes('partly')) && isNight) {
                const starCount = 50;
                
                for (let i = 0; i < starCount; i++) {
                    const star = document.createElement('div');
                    star.className = 'star';
                    star.style.left = Math.random() * 100 + '%';
                    star.style.top = Math.random() * 60 + '%';
                    star.style.animationDelay = Math.random() * 3 + 's';
                    star.style.animationDuration = (2 + Math.random() * 4) + 's';
                    effectsContainer.appendChild(star);
                }
            }

            // SUN RAYS EFFECT (for clear sunny days)
            if ((weatherDesc.includes('clear') || weatherDesc.includes('sunny')) && isDay && temp > 20) {
                const sunRays = document.createElement('div');
                sunRays.className = 'sun-rays';
                
                for (let i = 0; i < 12; i++) {
                    const ray = document.createElement('div');
                    ray.className = 'sun-ray';
                    ray.style.transform = `rotate(${i * 30}deg)`;
                    sunRays.appendChild(ray);
                }
                
                effectsContainer.appendChild(sunRays);
            }

            // WIND EFFECT (for windy conditions)
            if (weatherDesc.includes('wind') || weatherDesc.includes('breezy') || weatherDesc.includes('gust')) {
                // Add moving leaves/particles for wind
                const particleCount = 20;
                
                for (let i = 0; i < particleCount; i++) {
                    const particle = document.createElement('div');
                    particle.className = 'wind-particle';
                    particle.style.top = (Math.random() * 100) + '%';
                    particle.style.left = (-10 + Math.random() * -20) + '%';
                    particle.style.animationDuration = (2 + Math.random() * 3) + 's';
                    particle.style.animationDelay = (Math.random() * 5) + 's';
                    effectsContainer.appendChild(particle);
                }
            }

            // HAZE EFFECT (for hazy/dusty conditions)
            if (weatherDesc.includes('haze') || weatherDesc.includes('dust') || weatherDesc.includes('sand')) {
                const haze = document.createElement('div');
                haze.className = 'haze-overlay';
                effectsContainer.appendChild(haze);
            }
        }

        this.log(`✓ Applied weather effects for: ${weatherDesc}`);
    }

    removeWeatherEffects() {
        // Remove weather effects container
        const existingEffects = document.querySelector('.weather-effects');
        if (existingEffects) {
            existingEffects.remove();
        }
        
        // Remove lightning flash
        const existingLightning = document.querySelector('.lightning-flash');
        if (existingLightning) {
            existingLightning.remove();
        }
    }

    applyWeatherEffectsOnly() {
        // Get current weather and apply only the visual effects (not the gradient)
        const weatherDesc = document.getElementById('weatherDesc')?.textContent?.toLowerCase() || '';
        const weatherTemp = document.getElementById('weatherTemp')?.textContent || '';
        const temp = parseInt(weatherTemp);
        const hour = new Date().getHours();
        const isDay = hour >= 6 && hour < 18;
        const isNight = hour >= 21 || hour < 6;
        
        // Apply only the weather effects, not the gradient
        this.applyWeatherEffects(weatherDesc, temp, isDay, isNight);
    }

    updateThemeColors() {
        // Get current theme colors from computed styles
        const computedStyle = getComputedStyle(document.body);
        const gradientStart = computedStyle.getPropertyValue('--gradient-start').trim() || '#4a90e2';
        const gradientEnd = computedStyle.getPropertyValue('--gradient-end').trim() || '#667eea';
        
        // Calculate lighter/darker versions for UI elements
        const themeColor = `rgba(${this.hexToRgb(gradientStart)}, 0.3)`;
        const themeColorHover = `rgba(${this.hexToRgb(gradientStart)}, 0.6)`;
        
        // Set CSS variables for theme-aware elements
        document.documentElement.style.setProperty('--theme-color', themeColor);
        document.documentElement.style.setProperty('--theme-color-hover', themeColorHover);
        document.documentElement.style.setProperty('--theme-gradient-start', gradientStart);
        document.documentElement.style.setProperty('--theme-gradient-end', gradientEnd);
    }

    hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse hex to RGB
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return `${r}, ${g}, ${b}`;
    }

    loadSavedTheme() {
        const savedTheme = localStorage.getItem('selectedTheme');
        if (savedTheme) {
            if (this.themeSelect) {
                this.themeSelect.value = savedTheme;
            }
            // Don't save to profile when loading initial theme
            this.changeTheme(savedTheme, false);
        }
        
        // Load weather effects preference
        const savedEffectsPref = localStorage.getItem('weatherEffectsEnabled');
        if (savedEffectsPref === 'true') {
            this.weatherEffectsEnabled = true;
            const weatherEffectsToggle = document.getElementById('customizeWeatherEffectsToggle');
            if (weatherEffectsToggle) {
                weatherEffectsToggle.checked = true;
            }
            // Apply effects if not on a weather theme
            if (savedTheme && !savedTheme.startsWith('weather')) {
                this.applyWeatherEffectsOnly();
            }
        }
        
        // Load weather clouds preference
        const savedCloudsPref = localStorage.getItem('weatherCloudsEnabled');
        if (savedCloudsPref === 'true') {
            this.weatherCloudsEnabled = true;
            const weatherCloudsToggle = document.getElementById('customizeWeatherCloudsToggle');
            if (weatherCloudsToggle) {
                weatherCloudsToggle.checked = true;
            }
        }
        
        // Load individual widget frost preferences
        const weatherFrostPref = localStorage.getItem('weatherWidgetFrostEnabled');
        if (weatherFrostPref !== null) {
            this.weatherWidgetFrostEnabled = weatherFrostPref === 'true';
            if (!this.weatherWidgetFrostEnabled) {
                const widget = document.querySelector('.weather-widget');
                if (widget) {
                    widget.style.backdropFilter = 'none';
                    widget.style.background = 'transparent';
                }
            }
        }
        
        const remindersFrostPref = localStorage.getItem('remindersWidgetFrostEnabled');
        if (remindersFrostPref !== null) {
            this.remindersWidgetFrostEnabled = remindersFrostPref === 'true';
            if (!this.remindersWidgetFrostEnabled) {
                const widget = document.querySelector('.reminder-widget');
                if (widget) {
                    widget.style.backdropFilter = 'none';
                    widget.style.background = 'transparent';
                }
            }
        }
        
        const quicklinksFrostPref = localStorage.getItem('quicklinksWidgetFrostEnabled');
        if (quicklinksFrostPref !== null) {
            this.quicklinksWidgetFrostEnabled = quicklinksFrostPref === 'true';
            if (!this.quicklinksWidgetFrostEnabled) {
                const widget = document.querySelector('.quicklinks-widget');
                if (widget) {
                    widget.style.backdropFilter = 'none';
                    widget.style.background = 'transparent';
                }
            }
        }
        
        // Load sync settings if user is logged in
        if (this.userProfileManager.isUserLoggedIn()) {
            const customizationSettings = JSON.parse(localStorage.getItem('customizationSettings') || '{}');
            const user = this.userProfileManager.getCurrentUser();
            
            if (customizationSettings.autoSync !== undefined) {
                user.settings.autoSync = customizationSettings.autoSync;
            }
            if (customizationSettings.syncInterval) {
                user.settings.syncInterval = parseInt(customizationSettings.syncInterval);
            }
            if (customizationSettings.storageMode) {
                user.settings.storageMode = customizationSettings.storageMode;
            }
        }
    }

    updateGridLayout() {
        const linksGrid = document.getElementById('linksGrid');
        if (!linksGrid) return;

        const linkCount = linksGrid.querySelectorAll('.link-item').length;
        const rows = Math.ceil(linkCount / 4); // 4 links per row

        // Remove existing row classes
        linksGrid.classList.remove('row-1', 'row-2', 'row-3');

        // Add appropriate row class
        if (rows === 1) {
            linksGrid.classList.add('row-1');
        } else if (rows === 2) {
            linksGrid.classList.add('row-2');
        } else if (rows >= 3) {
            linksGrid.classList.add('row-3');
        }

        this.log(`Updated grid layout: ${linkCount} links, ${rows} rows`);
    }

    // Reminder functionality
    initReminders() {
        this.renderReminders();
        
        // Add reminder button
        if (this.addReminderBtn) {
            this.addReminderBtn.addEventListener('click', () => this.openReminderModal());
        }

        // Modal controls
        if (this.closeReminderModal) {
            this.closeReminderModal.addEventListener('click', () => this.closeReminderModalFn());
        }

        if (this.cancelReminderBtn) {
            this.cancelReminderBtn.addEventListener('click', () => this.closeReminderModalFn());
        }

        if (this.saveReminderBtn) {
            this.saveReminderBtn.addEventListener('click', () => this.saveReminder());
        }

        // Close modal on backdrop click
        if (this.reminderModal) {
            this.reminderModal.addEventListener('click', (e) => {
                if (e.target === this.reminderModal) {
                    this.closeReminderModalFn();
                }
            });
        }

        // Check for due reminders periodically (store for cleanup)
        this.intervals.reminders = setInterval(() => this.checkDueReminders(), 60000);
    }

    openReminderModal() {
        if (this.reminderModal) {
            this.reminderModal.classList.add('active');
            // Clear form
            document.getElementById('reminderText').value = '';
            document.getElementById('reminderPriority').value = 'medium';
            document.getElementById('reminderDate').value = '';
            document.getElementById('reminderText').focus();
        }
    }

    closeReminderModalFn() {
        if (this.reminderModal) {
            this.reminderModal.classList.remove('active');
        }
    }

    saveReminder() {
        const text = document.getElementById('reminderText').value.trim();
        const priority = document.getElementById('reminderPriority').value;
        const date = document.getElementById('reminderDate').value;

        if (!text) {
            alert('Please enter reminder text');
            return;
        }

        const reminder = {
            id: Date.now(),
            text: text,
            priority: priority,
            date: date || null,
            createdAt: new Date().toISOString(),
            completed: false
        };

        this.reminders.unshift(reminder);
        this.saveReminders();
        this.renderReminders();
        this.closeReminderModalFn();
    }

    deleteReminder(id) {
        this.reminders = this.reminders.filter(r => r.id !== id);
        this.saveReminders();
        this.renderReminders();
    }

    toggleReminder(id) {
        const reminder = this.reminders.find(r => r.id === id);
        if (reminder) {
            reminder.completed = !reminder.completed;
            this.saveReminders();
            this.renderReminders();
        }
    }

    renderReminders() {
        if (!this.reminderList) return;

        if (this.reminders.length === 0) {
            this.reminderList.innerHTML = '<div class="no-reminders">No reminders yet</div>';
            return;
        }

        const sortedReminders = [...this.reminders].sort((a, b) => {
            // Sort by completed status, then by priority, then by date
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
            
            if (a.date && b.date) return new Date(a.date) - new Date(b.date);
            if (a.date) return -1;
            if (b.date) return 1;
            
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Helper function to escape HTML and prevent XSS
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        this.reminderList.innerHTML = sortedReminders.map(reminder => {
            const dueDate = reminder.date ? new Date(reminder.date) : null;
            const isOverdue = dueDate && dueDate < new Date();
            const formattedDate = dueDate ? 
                dueDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : '';

            return `
                <div class="reminder-item priority-${reminder.priority} ${reminder.completed ? 'completed' : ''}" data-id="${reminder.id}">
                    <div class="reminder-text ${reminder.completed ? 'completed' : ''}">${escapeHtml(reminder.text)}</div>
                    <div class="reminder-meta">
                        <div class="reminder-date ${isOverdue && !reminder.completed ? 'overdue' : ''}">
                            ${formattedDate}
                        </div>
                        <div class="reminder-actions">
                            <button class="reminder-action-btn toggle" onclick="window.newTabHomepage.toggleReminder(${reminder.id})" title="${reminder.completed ? 'Mark incomplete' : 'Mark complete'}">
                                <i class="fas fa-${reminder.completed ? 'undo' : 'check'}"></i>
                            </button>
                            <button class="reminder-action-btn delete" onclick="window.newTabHomepage.deleteReminder(${reminder.id})" title="Delete reminder">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    saveReminders() {
        localStorage.setItem('reminders', JSON.stringify(this.reminders));
        
        // Also save to user profile if logged in
        if (this.userProfileManager && this.userProfileManager.isUserLoggedIn()) {
            const user = this.userProfileManager.getCurrentUser();
            if (user) {
                user.reminders = this.reminders;
                // Save the updated profile
                this.userProfileManager.getDecryptionPassword().then(password => {
                    if (password) {
                        this.userProfileManager.saveUserProfile(user.username, user, password);
                    }
                }).catch(err => {
                    console.error('Failed to save reminders to profile:', err);
                });
            }
        }
    }

    checkDueReminders() {
        const now = new Date();
        this.reminders.forEach(reminder => {
            if (!reminder.completed && reminder.date && !reminder.notified) {
                const dueDate = new Date(reminder.date);
                if (dueDate <= now) {
                    this.showReminderNotification(reminder);
                    reminder.notified = true;
                    this.saveReminders();
                }
            }
        });
    }

    showReminderNotification(reminder) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Reminder Due!', {
                body: reminder.text,
                icon: '/favicon.ico'
            });
        } else {
            // Fallback to browser alert
            alert(`Reminder Due: ${reminder.text}`);
        }
    }

    // Profile and Sync Methods
    setupProfileEventListeners() {
        // Profile dropdown toggle
        if (this.profileBtn) {
            this.profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleProfileDropdown();
            });
        }

        // Profile dropdown menu items
        const profileMenuBtn = document.getElementById('profileMenuBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        
        if (profileMenuBtn) {
            profileMenuBtn.addEventListener('click', () => {
                this.closeProfileDropdown();
                this.openProfilePanel();
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.closeProfileDropdown();
                this.performManualSync();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.querySelector('.profile-dropdown');
            if (!dropdown.contains(e.target)) {
                this.closeProfileDropdown();
            }
        });

        // Sync button click
        if (this.syncBtn) {
            this.syncBtn.addEventListener('click', () => this.performManualSync());
        }

        // Close profile panel
        if (this.closeProfilePanel) {
            this.closeProfilePanel.addEventListener('click', () => this.closeProfilePanelFn());
        }

        // Profile tabs switching
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                this.switchProfileTab(tabName);
            });
        });

        // Auth tabs
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        if (loginTab) loginTab.addEventListener('click', () => this.switchAuthTab('login'));
        if (registerTab) registerTab.addEventListener('click', () => this.switchAuthTab('register'));

        // Auth buttons
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const importAccountBtn = document.getElementById('importAccountBtn');
        
        if (loginBtn) loginBtn.addEventListener('click', () => this.handleLogin());
        if (registerBtn) registerBtn.addEventListener('click', () => this.handleRegister());
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.handleLogout());
        if (importAccountBtn) importAccountBtn.addEventListener('click', () => this.handleImportAccount());

        // Clear account data link
        const clearAccountLink = document.getElementById('clearAccountLink');
        if (clearAccountLink) {
            clearAccountLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleClearAccountData();
            });
        }

        // Sync settings
        const autoSyncToggle = document.getElementById('autoSyncToggle');
        const syncInterval = document.getElementById('syncInterval');
        const manualSyncBtn = document.getElementById('manualSyncBtn');

        if (autoSyncToggle) {
            autoSyncToggle.addEventListener('change', (e) => this.toggleAutoSync(e.target.checked));
        }
        if (syncInterval) {
            syncInterval.addEventListener('change', (e) => this.updateSyncInterval(e.target.value));
        }
        if (manualSyncBtn) {
            manualSyncBtn.addEventListener('click', () => this.performManualSync());
        }

        // Storage settings
        const storageMode = document.getElementById('storageMode');

        if (storageMode) {
            storageMode.addEventListener('change', (e) => this.handleStorageModeChange(e.target.value));
        }

        // Import/Export
        const exportDataBtn = document.getElementById('exportDataBtn');
        const importDataBtn = document.getElementById('importDataBtn');
        const importFileInput = document.getElementById('importFileInput');
        const updateProfileBtn = document.getElementById('updateProfileBtn');
        
        // Avatar change
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        const avatarInput = document.getElementById('avatarInput');
        
        // Edit profile
        const editProfileBtn = document.getElementById('editProfileBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');

        if (exportDataBtn) exportDataBtn.addEventListener('click', () => this.exportUserData());
        if (importDataBtn) importDataBtn.addEventListener('click', () => this.importUserData());
        if (updateProfileBtn) updateProfileBtn.addEventListener('click', () => this.handleUpdateProfile());
        if (changeAvatarBtn) changeAvatarBtn.addEventListener('click', () => avatarInput.click());
        if (avatarInput) avatarInput.addEventListener('change', (e) => this.handleAvatarChange(e));
        if (editProfileBtn) editProfileBtn.addEventListener('click', () => this.enableProfileEdit());
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => this.disableProfileEdit());
        if (importFileInput) {
            importFileInput.addEventListener('change', (e) => this.handleImportFile(e));
        }

        // Enter key handlers for forms
        const authInputs = document.querySelectorAll('.profile-input');
        authInputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const activeTab = document.querySelector('.auth-tab.active').id;
                    if (activeTab === 'loginTab') {
                        this.handleLogin();
                    } else {
                        this.handleRegister();
                    }
                }
            });
        });
    }

    async initializeProfileSystem() {
        try {
            // Check if user is already logged in
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for userProfileManager to initialize
            
            // Check if migration needed
            const needsMigration = localStorage.getItem('user_password_hash_enc') !== null;
            
            if (this.userProfileManager.isUserLoggedIn()) {
                this.updateUIForLoggedInUser();
                await this.loadUserProfile();
            } else {
                this.updateUIForLoggedOutUser();
                
                // Show friendly migration message if needed
                if (needsMigration) {
                    setTimeout(() => {
                        this.showAuthMessage('Storage updated! Please login again to continue.', 'info');
                    }, 1000);
                }
            }
            
            // Add beforeunload handler to save user data before closing browser
            // Note: beforeunload doesn't guarantee async operations complete
            // We use a synchronous approach with localStorage
            window.addEventListener('beforeunload', (e) => {
                if (this.userProfileManager.isUserLoggedIn()) {
                    try {
                        // Trigger sync (will use localStorage which is synchronous)
                        this.userProfileManager.syncUserDataSync();
                    } catch (error) {
                        console.error('Error saving data before unload:', error);
                    }
                }
            });
        } catch (error) {
            console.error('Error initializing profile system:', error);
        }
    }

    openProfilePanel() {
        if (this.profilePanel) {
            this.profilePanel.classList.add('active');
            
            if (this.userProfileManager.isUserLoggedIn()) {
                this.showProfileDisplay();
                this.loadUserProfile(); // Refresh data when opening
                
                // If customize tab is active, populate links manager
                setTimeout(() => {
                    const customizeTab = document.querySelector('.profile-tab-content[data-content="customize"]');
                    if (customizeTab && customizeTab.classList.contains('active')) {
                        this.populateLinksManager();
                    }
                }, 400);
            } else {
                this.showAuthForm();
            }
        }
    }

    closeProfilePanelFn() {
        if (this.profilePanel) {
            this.profilePanel.classList.remove('active');
            this.clearAuthMessage();
        }
    }

    switchAuthTab(tab) {
        // Switch tab buttons
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.getElementById(`${tab}Tab`).classList.add('active');

        // Switch content
        document.querySelectorAll('.auth-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`${tab}Form`).classList.add('active');

        this.clearAuthMessage();
    }

    switchProfileTab(tabName) {
        // Switch tab buttons
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`.profile-tab[data-tab="${tabName}"]`).classList.add('active');

        // Switch content
        document.querySelectorAll('.profile-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelector(`.profile-tab-content[data-content="${tabName}"]`).classList.add('active');
        
        // Re-initialize tab elements when switching
        if (tabName === 'customize') {
            this.reinitializeCustomizeTab();
        } else if (tabName === 'settings') {
            this.reinitializeSettingsTab();
        }
    }
    
    reinitializeSettingsTab() {
        this.log('[SETTINGS] Reinitializing settings tab elements...');
        
        // Auto sync toggle
        const autoSyncToggle = document.getElementById('autoSyncToggle');
        if (autoSyncToggle && !autoSyncToggle.dataset.initialized) {
            const user = this.userProfileManager.getCurrentUser();
            if (user && user.settings) {
                autoSyncToggle.checked = user.settings.autoSync;
            }
            autoSyncToggle.dataset.initialized = 'true';
        }
        
        // Sync interval
        const syncInterval = document.getElementById('syncInterval');
        if (syncInterval && !syncInterval.dataset.initialized) {
            const user = this.userProfileManager.getCurrentUser();
            if (user && user.settings) {
                syncInterval.value = user.settings.syncInterval;
            }
            syncInterval.dataset.initialized = 'true';
        }
        
        // Storage mode
        const storageMode = document.getElementById('storageMode');
        if (storageMode && !storageMode.dataset.initialized) {
            const user = this.userProfileManager.getCurrentUser();
            if (user && user.settings) {
                storageMode.value = user.settings.storageMode;
            }
            storageMode.dataset.initialized = 'true';
        }
        
        // Update storage info when tab is shown
        this.updateStorageInfo();
        
        this.log('[SETTINGS] Settings tab elements initialized');
    }
    
    async updateStorageInfo() {
        const dataSize = document.getElementById('dataSize');
        const currentStoragePath = document.getElementById('currentStoragePath');
        const storagePath = document.getElementById('storagePath');
        const lastSyncTime = document.getElementById('lastSyncTime');
        
        try {
            const storageInfo = await this.userProfileManager.getStorageInfo();
            this.log('[SETTINGS] Storage info:', storageInfo);
            if (currentStoragePath) currentStoragePath.textContent = storageInfo.path || 'Browser Default';
            if (dataSize) dataSize.textContent = storageInfo.size || '0 B';
            if (storagePath) storagePath.textContent = storageInfo.location || 'localStorage (browser)';
            
            // Update last sync time
            const user = this.userProfileManager.getCurrentUser();
            if (user && lastSyncTime) {
                lastSyncTime.textContent = user.lastSync 
                    ? new Date(user.lastSync).toLocaleString()
                    : 'Never';
            }
        } catch (error) {
            console.error('[SETTINGS] Error getting storage info:', error);
            if (dataSize) dataSize.textContent = '0 B';
            if (currentStoragePath) currentStoragePath.textContent = 'Browser Default';
            if (storagePath) storagePath.textContent = 'localStorage (browser)';
        }
    }
    
    reinitializeCustomizeTab() {
        this.log('[CUSTOMIZE] Reinitializing customize tab elements...');
        
        // Initialize collapsible sections
        const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
        collapsibleHeaders.forEach(header => {
            if (!header.dataset.initialized) {
                header.addEventListener('click', () => {
                    const section = header.dataset.section;
                    const content = document.getElementById(section + 'Content');
                    
                    if (content) {
                        const isActive = content.classList.contains('active');
                        
                        // Toggle active state
                        if (isActive) {
                            content.classList.remove('active');
                            header.classList.remove('active');
                        } else {
                            content.classList.add('active');
                            header.classList.add('active');
                        }
                        
                        this.log('[CUSTOMIZE] Toggled section:', section, !isActive);
                    }
                });
                header.dataset.initialized = 'true';
            }
        });
        
        // Theme selector
        const themeSelect = document.getElementById('customizeThemeSelect');
        if (themeSelect && !themeSelect.dataset.initialized) {
            // Set current theme value
            themeSelect.value = this.currentTheme;
            
            themeSelect.addEventListener('change', (e) => {
                this.log('[CUSTOMIZE] Theme changed to:', e.target.value);
                this.changeTheme(e.target.value);
            });
            themeSelect.dataset.initialized = 'true';
            this.log('[CUSTOMIZE] Theme selector initialized');
        }
        
        // Weather effects toggle
        const weatherEffectsToggle = document.getElementById('customizeWeatherEffectsToggle');
        if (weatherEffectsToggle && !weatherEffectsToggle.dataset.initialized) {
            // Load saved preference
            const savedEffectsPref = localStorage.getItem('weatherEffectsEnabled');
            if (savedEffectsPref !== null) {
                this.weatherEffectsEnabled = savedEffectsPref === 'true';
            }
            weatherEffectsToggle.checked = this.weatherEffectsEnabled;
            
            weatherEffectsToggle.addEventListener('change', (e) => {
                this.log('[CUSTOMIZE] Weather effects toggled:', e.target.checked);
                this.toggleWeatherEffects(e.target.checked);
            });
            weatherEffectsToggle.dataset.initialized = 'true';
            this.log('[CUSTOMIZE] Weather effects toggle initialized');
        }
        
        // Weather clouds toggle
        const weatherCloudsToggle = document.getElementById('customizeWeatherCloudsToggle');
        if (weatherCloudsToggle && !weatherCloudsToggle.dataset.initialized) {
            // Load saved preference
            const savedCloudsPref = localStorage.getItem('weatherCloudsEnabled');
            if (savedCloudsPref !== null) {
                this.weatherCloudsEnabled = savedCloudsPref === 'true';
            }
            weatherCloudsToggle.checked = this.weatherCloudsEnabled;
            
            weatherCloudsToggle.addEventListener('change', (e) => {
                this.log('[CUSTOMIZE] Weather clouds toggled:', e.target.checked);
                this.toggleWeatherClouds(e.target.checked);
            });
            weatherCloudsToggle.dataset.initialized = 'true';
            this.log('[CUSTOMIZE] Weather clouds toggle initialized');
        }
        
        // Weather widget frost toggle
        const weatherWidgetFrostToggle = document.getElementById('weatherWidgetFrostToggle');
        if (weatherWidgetFrostToggle && !weatherWidgetFrostToggle.dataset.initialized) {
            const savedPref = localStorage.getItem('weatherWidgetFrostEnabled');
            if (savedPref !== null) {
                this.weatherWidgetFrostEnabled = savedPref === 'true';
            }
            weatherWidgetFrostToggle.checked = this.weatherWidgetFrostEnabled;
            
            weatherWidgetFrostToggle.addEventListener('change', (e) => {
                this.log('[CUSTOMIZE] Weather widget frost toggled:', e.target.checked);
                this.toggleWeatherWidgetFrost(e.target.checked);
            });
            weatherWidgetFrostToggle.dataset.initialized = 'true';
            this.log('[CUSTOMIZE] Weather widget frost toggle initialized');
        }
        
        // Reminders widget frost toggle
        const remindersWidgetFrostToggle = document.getElementById('remindersWidgetFrostToggle');
        if (remindersWidgetFrostToggle && !remindersWidgetFrostToggle.dataset.initialized) {
            const savedPref = localStorage.getItem('remindersWidgetFrostEnabled');
            if (savedPref !== null) {
                this.remindersWidgetFrostEnabled = savedPref === 'true';
            }
            remindersWidgetFrostToggle.checked = this.remindersWidgetFrostEnabled;
            
            remindersWidgetFrostToggle.addEventListener('change', (e) => {
                this.log('[CUSTOMIZE] Reminders widget frost toggled:', e.target.checked);
                this.toggleRemindersWidgetFrost(e.target.checked);
            });
            remindersWidgetFrostToggle.dataset.initialized = 'true';
            this.log('[CUSTOMIZE] Reminders widget frost toggle initialized');
        }
        
        // Quick Links widget frost toggle
        const quicklinksWidgetFrostToggle = document.getElementById('quicklinksWidgetFrostToggle');
        if (quicklinksWidgetFrostToggle && !quicklinksWidgetFrostToggle.dataset.initialized) {
            const savedPref = localStorage.getItem('quicklinksWidgetFrostEnabled');
            if (savedPref !== null) {
                this.quicklinksWidgetFrostEnabled = savedPref === 'true';
            }
            quicklinksWidgetFrostToggle.checked = this.quicklinksWidgetFrostEnabled;
            
            quicklinksWidgetFrostToggle.addEventListener('change', (e) => {
                this.log('[CUSTOMIZE] Quick Links widget frost toggled:', e.target.checked);
                this.toggleQuicklinksWidgetFrost(e.target.checked);
            });
            quicklinksWidgetFrostToggle.dataset.initialized = 'true';
            this.log('[CUSTOMIZE] Quick Links widget frost toggle initialized');
        }
        
        // Add link button
        const addLinkBtn = document.getElementById('customizeAddLinkBtn');
        if (addLinkBtn && !addLinkBtn.dataset.initialized) {
            addLinkBtn.addEventListener('click', (e) => {
                this.log('[CUSTOMIZE] Add link clicked');
                e.preventDefault();
                this.addLink();
            });
            addLinkBtn.dataset.initialized = 'true';
            this.log('[CUSTOMIZE] Add link button initialized');
        }
        
        // Apply link order button
        const applyLinkOrderBtn = document.getElementById('applyLinkOrderBtn');
        if (applyLinkOrderBtn && !applyLinkOrderBtn.dataset.initialized) {
            applyLinkOrderBtn.addEventListener('click', (e) => {
                this.log('[CUSTOMIZE] Apply link order clicked');
                e.preventDefault();
                this.applyNewLinkOrder();
            });
            applyLinkOrderBtn.dataset.initialized = 'true';
            this.log('[CUSTOMIZE] Apply link order button initialized');
        }
        
        // Weather API provider selector
        const weatherApiProvider = document.getElementById('weatherApiProvider');
        const weatherApiKeySection = document.getElementById('weatherApiKeySection');
        const weatherApiKey = document.getElementById('weatherApiKey');
        
        if (weatherApiProvider && !weatherApiProvider.dataset.initialized) {
            // Load saved provider
            weatherApiProvider.value = this.getWeatherApiProvider();
            
            // Show/hide API key field based on provider
            const toggleApiKeyField = () => {
                if (weatherApiProvider.value === 'openweather') {
                    weatherApiKeySection.style.display = 'block';
                } else {
                    weatherApiKeySection.style.display = 'none';
                }
            };
            toggleApiKeyField();
            
            weatherApiProvider.addEventListener('change', (e) => {
                this.setWeatherApiProvider(e.target.value);
                toggleApiKeyField();
            });
            weatherApiProvider.dataset.initialized = 'true';
        }
        
        if (weatherApiKey && !weatherApiKey.dataset.initialized) {
            // Load saved API key
            weatherApiKey.value = this.getWeatherApiKey();
            
            weatherApiKey.addEventListener('change', (e) => {
                this.setWeatherApiKey(e.target.value.trim());
            });
            weatherApiKey.dataset.initialized = 'true';
        }
        
        // Weather location input and search
        const weatherLocationInput = document.getElementById('customizeWeatherLocationInput');
        const updateWeatherBtn = document.getElementById('customizeUpdateWeatherBtn');
        
        // Load current weather city if available
        if (weatherLocationInput && this.weatherData && this.weatherData.name) {
            weatherLocationInput.value = this.weatherData.name;
        }
        
        if (updateWeatherBtn && !updateWeatherBtn.dataset.initialized) {
            updateWeatherBtn.addEventListener('click', () => {
                const city = weatherLocationInput.value.trim();
                this.log('[CUSTOMIZE] Weather search clicked for:', city);
                if (city) {
                    this.fetchWeatherByCity(city);
                }
            });
            updateWeatherBtn.dataset.initialized = 'true';
            this.log('[CUSTOMIZE] Weather search button initialized');
        }
        
        // Test API Query button
        const testApiBtn = document.getElementById('testApiQueryBtn');
        if (testApiBtn && !testApiBtn.dataset.initialized) {
            testApiBtn.addEventListener('click', async () => {
                const city = weatherLocationInput.value.trim() || 'London';
                const apiProvider = this.getWeatherApiProvider();
                
                try {
                    // Show loading state
                    testApiBtn.disabled = true;
                    testApiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
                    
                    if (apiProvider === 'weatherapi') {
                        // Test WeatherAPI.com
                        const apiKey = this.getWeatherApiKey();
                        if (!apiKey) {
                            alert('WeatherAPI key required!\n\nPlease enter your API key first.\nGet a free key at: weatherapi.com');
                            return;
                        }
                        
                        const weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&aqi=no`;
                        const response = await fetch(weatherUrl);
                        const data = await response.json();
                        
                        if (data.error) {
                            alert('API ERROR\n\n' + data.error.message);
                            return;
                        }
                        
                        const message = 
                            '=== WEATHER API TEST ===\n' +
                            'Provider: WeatherAPI.com\n\n' +
                            'LOCATION\n' +
                            '  City: ' + data.location.name + ', ' + data.location.region + ', ' + data.location.country + '\n' +
                            '  Latitude: ' + data.location.lat + '\n' +
                            '  Longitude: ' + data.location.lon + '\n' +
                            '  Timezone: ' + data.location.tz_id + '\n\n' +
                            'CURRENT WEATHER\n' +
                            '  Temperature: ' + data.current.temp_c + 'C\n' +
                            '  Condition: ' + data.current.condition.text + '\n' +
                            '  Wind Speed: ' + data.current.wind_kph + ' km/h\n' +
                            '  Wind Direction: ' + data.current.wind_dir + '\n' +
                            '  Humidity: ' + data.current.humidity + '%\n' +
                            '  Last Updated: ' + data.current.last_updated + '\n\n' +
                            'API ENDPOINT\n' +
                            '  ' + weatherUrl.replace(apiKey, '***KEY***');
                        
                        alert(message);
                        return;
                    }
                    
                    // Test Open-Meteo (default)
                    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
                    const geocodeResponse = await fetch(geocodeUrl);
                    const geocodeData = await geocodeResponse.json();
                    
                    if (geocodeData.results && geocodeData.results.length > 0) {
                        const location = geocodeData.results[0];
                        
                        // Test weather API
                        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current_weather=true&timezone=auto`;
                        const weatherResponse = await fetch(weatherUrl);
                        const weatherData = await weatherResponse.json();
                        const current = weatherData.current_weather;
                        
                        // Weather code descriptions
                        const weatherCodes = {
                            0: 'Clear sky',
                            1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
                            45: 'Fog', 48: 'Depositing rime fog',
                            51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
                            61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
                            71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
                            77: 'Snow grains',
                            80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
                            85: 'Slight snow showers', 86: 'Heavy snow showers',
                            95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
                        };
                        
                        const weatherDesc = weatherCodes[current.weathercode] || 'Unknown';
                        const locationStr = location.admin1 ? location.name + ', ' + location.admin1 + ', ' + location.country : location.name + ', ' + location.country;
                        
                        const message = 
                            '=== WEATHER API TEST ===\n' +
                            'Provider: Open-Meteo (Free)\n\n' +
                            'LOCATION\n' +
                            '  City: ' + locationStr + '\n' +
                            '  Latitude: ' + location.latitude + '\n' +
                            '  Longitude: ' + location.longitude + '\n' +
                            '  Timezone: ' + weatherData.timezone + '\n\n' +
                            'CURRENT WEATHER\n' +
                            '  Temperature: ' + current.temperature + 'C\n' +
                            '  Condition: ' + weatherDesc + ' (code: ' + current.weathercode + ')\n' +
                            '  Wind Speed: ' + current.windspeed + ' km/h\n' +
                            '  Wind Direction: ' + current.winddirection + ' degrees\n' +
                            '  Time: ' + current.time + '\n\n' +
                            'API ENDPOINTS\n' +
                            '  Geocoding: ' + geocodeUrl + '\n\n' +
                            '  Weather: ' + weatherUrl;
                        
                        alert(message);
                    } else {
                        alert('CITY NOT FOUND\n\nNo results for: ' + city + '\n\nPlease check the spelling and try again.');
                    }
                } catch (error) {
                    const errorMsg = 
                        '=== API TEST FAILED ===\n\n' +
                        'Error: ' + error.message + '\n\n' +
                        'This could be due to:\n' +
                        '  - Network connection issues\n' +
                        '  - API service unavailable\n' +
                        '  - Invalid city name\n\n' +
                        'Please check your internet connection and try again.';
                    alert(errorMsg);
                } finally {
                    testApiBtn.disabled = false;
                    testApiBtn.innerHTML = '<i class="fas fa-vial"></i> Test API';
                }
            });
            testApiBtn.dataset.initialized = 'true';
        }
        
        if (weatherLocationInput && !weatherLocationInput.dataset.initialized) {
            weatherLocationInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const city = weatherLocationInput.value.trim();
                    this.log('[CUSTOMIZE] Weather search enter for:', city);
                    if (city) {
                        this.fetchWeatherByCity(city);
                    }
                }
            });
            weatherLocationInput.dataset.initialized = 'true';
            this.log('[CUSTOMIZE] Weather location input initialized');
        }
        
        // Weather refresh interval
        const weatherRefreshInterval = document.getElementById('customizeWeatherRefreshInterval');
        if (weatherRefreshInterval && !weatherRefreshInterval.dataset.initialized) {
            // Load saved interval
            const savedInterval = this.loadWeatherRefreshInterval();
            this.weatherRefreshInterval = savedInterval;
            weatherRefreshInterval.value = this.weatherRefreshInterval;
            
            weatherRefreshInterval.addEventListener('change', (e) => {
                this.log('[CUSTOMIZE] Weather refresh interval changed to:', e.target.value);
                this.handleWeatherRefreshChange(e.target.value);
            });
            weatherRefreshInterval.dataset.initialized = 'true';
            this.log('[CUSTOMIZE] Weather refresh interval initialized');
        }
        
        this.log('[CUSTOMIZE] All customize elements initialized');
        
        // Populate links manager with a delay to ensure DOM is ready
        setTimeout(() => {
            this.populateLinksManager();
        }, 300);
    }

    // Helper function to escape HTML and prevent XSS
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Draggable Widgets System
    initDraggableWidgets() {
        const widgets = document.querySelectorAll('.draggable-widget');
        
        widgets.forEach(widget => {
            const widgetId = widget.dataset.widget;
            const handle = widget.querySelector('.widget-drag-handle');
            
            if (!handle) return;
            
            // Load saved position
            this.loadWidgetPosition(widget, widgetId);
            
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;
            
            handle.addEventListener('mousedown', (e) => {
                // Don't drag if clicking on buttons, inputs, or editable content
                if (e.target.closest('button') || 
                    e.target.closest('input') || 
                    e.target.closest('[contenteditable="true"]') ||
                    e.target.hasAttribute('contenteditable')) {
                    return;
                }
                
                isDragging = true;
                widget.classList.add('dragging');
                
                // Remove transform to allow proper left/top positioning
                if (widget.style.transform && widget.style.transform.includes('translate')) {
                    widget.style.transform = 'none';
                }
                
                // Get current position from computed style or element position
                const rect = widget.getBoundingClientRect();
                const computedLeft = parseInt(window.getComputedStyle(widget).left) || rect.left;
                const computedTop = parseInt(window.getComputedStyle(widget).top) || rect.top;
                
                xOffset = computedLeft;
                yOffset = computedTop;
                
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                
                e.preventDefault();
                
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                // Add padding from edges (20px minimum space)
                const edgePadding = 20;
                const widgetWidth = widget.offsetWidth;
                const widgetHeight = widget.offsetHeight;
                const maxX = window.innerWidth - widgetWidth - edgePadding;
                const maxY = window.innerHeight - widgetHeight - edgePadding;
                
                currentX = Math.max(edgePadding, Math.min(currentX, maxX));
                currentY = Math.max(edgePadding, Math.min(currentY, maxY));
                
                xOffset = currentX;
                yOffset = currentY;
                
                widget.style.left = currentX + 'px';
                widget.style.top = currentY + 'px';
                widget.style.right = 'auto';
                widget.style.bottom = 'auto';
            });
            
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    widget.classList.remove('dragging');
                    
                    // Save position and size to profile
                    const size = {
                        width: widget.offsetWidth,
                        height: widget.offsetHeight
                    };
                    this.saveWidgetPosition(widgetId, currentX, currentY, size);
                }
            });
            
            // Watch for resize events (when user manually resizes the widget itself)
            if (window.ResizeObserver) {
                let resizeDebounce;
                const resizeObserver = new ResizeObserver(() => {
                    // Debounce to avoid saving during browser window resize
                    clearTimeout(resizeDebounce);
                    resizeDebounce = setTimeout(() => {
                        if (!isDragging) {
                            const savedPositions = this.getSavedWidgetPositions();
                            if (savedPositions && savedPositions[widgetId]) {
                                const size = {
                                    width: widget.offsetWidth,
                                    height: widget.offsetHeight
                                };
                                // Only update size, don't recalculate position percentages
                                savedPositions[widgetId].width = size.width;
                                savedPositions[widgetId].height = size.height;
                                localStorage.setItem('widgetPositions', JSON.stringify(savedPositions));
                                console.log('[WIDGET] Updated size only:', widgetId, size);
                            }
                        }
                    }, 250);
                });
                resizeObserver.observe(widget);
            }
        });
        
        this.log('[WIDGETS] Initialized draggable widgets');
        
        // Store original window dimensions for resize calculations
        let previousWidth = window.innerWidth;
        let previousHeight = window.innerHeight;
        
        // Handle window resize to keep widgets proportionally positioned
        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const currentWidth = window.innerWidth;
                const currentHeight = window.innerHeight;
                
                // Only reposition if window size actually changed
                if (currentWidth === previousWidth && currentHeight === previousHeight) {
                    return;
                }
                
                widgets.forEach(widget => {
                    const widgetId = widget.dataset.widget;
                    const savedPositions = this.getSavedWidgetPositions();
                    
                    if (savedPositions && savedPositions[widgetId]) {
                        const saved = savedPositions[widgetId];
                        
                        console.log('[RESIZE] Widget:', widgetId, 'Saved:', saved);
                        
                        // Use percentage-based positioning for proportional scaling
                        if (saved.xPercent !== undefined && saved.yPercent !== undefined) {
                            const newX = (saved.xPercent / 100) * currentWidth;
                            const newY = (saved.yPercent / 100) * currentHeight;
                            
                            console.log('[RESIZE] New position:', widgetId, 'X:', newX, 'Y:', newY, 'from %:', saved.xPercent, saved.yPercent);
                            
                            // Apply new position based on percentages
                            widget.style.left = newX + 'px';
                            widget.style.top = newY + 'px';
                            
                            // Scale size proportionally if percentage size is saved
                            if (saved.widthPercent !== undefined && saved.heightPercent !== undefined) {
                                const newWidth = (saved.widthPercent / 100) * currentWidth;
                                const newHeight = (saved.heightPercent / 100) * currentHeight;
                                
                                widget.style.width = newWidth + 'px';
                                widget.style.height = newHeight + 'px';
                                
                                console.log('[RESIZE] New size:', widgetId, 'W:', newWidth, 'H:', newHeight);
                            }
                        } else {
                            console.warn('[RESIZE] No percentage data for:', widgetId);
                        }
                    }
                });
                
                previousWidth = currentWidth;
                previousHeight = currentHeight;
            }, 50);
        };
        
        window.addEventListener('resize', handleResize);
    }
    
    loadWidgetPosition(widget, widgetId) {
        const savedPositions = this.getSavedWidgetPositions();
        
        if (savedPositions && savedPositions[widgetId]) {
            const saved = savedPositions[widgetId];
            let x, y;
            
            // Check if position is stored as percentage (new format)
            if (saved.xPercent !== undefined && saved.yPercent !== undefined) {
                // Convert percentage to pixels based on current viewport
                x = (saved.xPercent / 100) * window.innerWidth;
                y = (saved.yPercent / 100) * window.innerHeight;
            } else if (saved.x !== undefined && saved.y !== undefined) {
                // Old format: use pixels but convert to percentages for future
                x = saved.x;
                y = saved.y;
                
                // Silently update to new percentage format
                const xPercent = (saved.x / window.innerWidth) * 100;
                const yPercent = (saved.y / window.innerHeight) * 100;
                
                const positions = this.getSavedWidgetPositions();
                positions[widgetId].xPercent = xPercent;
                positions[widgetId].yPercent = yPercent;
                localStorage.setItem('widgetPositions', JSON.stringify(positions));
            } else {
                return; // No valid position data
            }
            
            // Validate position is within visible viewport
            const isVisible = x >= 0 && 
                            x < window.innerWidth - 100 && 
                            y >= 0 && 
                            y < window.innerHeight - 100;
            
            if (!isVisible) {
                const positions = this.getSavedWidgetPositions();
                delete positions[widgetId];
                localStorage.setItem('widgetPositions', JSON.stringify(positions));
                return;
            }
            
            widget.style.left = x + 'px';
            widget.style.top = y + 'px';
            widget.style.right = 'auto';
            widget.style.bottom = 'auto';
            widget.style.transform = 'none';
            
            // Restore size if saved - use percentage if available for responsive scaling
            if (saved.widthPercent !== undefined && saved.heightPercent !== undefined) {
                const width = (saved.widthPercent / 100) * window.innerWidth;
                const height = (saved.heightPercent / 100) * window.innerHeight;
                widget.style.width = width + 'px';
                widget.style.height = height + 'px';
            } else if (saved.width && saved.height) {
                // Fallback to pixel values and convert to percentages
                widget.style.width = saved.width + 'px';
                widget.style.height = saved.height + 'px';
                
                // Update to percentage format
                const positions = this.getSavedWidgetPositions();
                positions[widgetId].widthPercent = parseFloat(((saved.width / window.innerWidth) * 100).toFixed(2));
                positions[widgetId].heightPercent = parseFloat(((saved.height / window.innerHeight) * 100).toFixed(2));
                localStorage.setItem('widgetPositions', JSON.stringify(positions));
            }
        }
    }
    
    getSavedWidgetPositions() {
        // First check profile data
        if (this.userProfileManager && this.userProfileManager.isUserLoggedIn()) {
            const user = this.userProfileManager.getCurrentUser();
            if (user && user.profile && user.profile.widgetPositions) {
                return user.profile.widgetPositions;
            }
        }
        
        // Fallback to localStorage
        const saved = localStorage.getItem('widgetPositions');
        return saved ? JSON.parse(saved) : {};
    }
    
    saveWidgetPosition(widgetId, x, y, size = null) {
        const positions = this.getSavedWidgetPositions();
        
        // Save position as both pixels and percentage for responsive behavior
        const xPercent = (x / window.innerWidth) * 100;
        const yPercent = (y / window.innerHeight) * 100;
        
        positions[widgetId] = { 
            x: Math.round(x), 
            y: Math.round(y),
            xPercent: parseFloat(xPercent.toFixed(2)),
            yPercent: parseFloat(yPercent.toFixed(2))
        };
        
        // Save size as percentage if provided
        if (size) {
            positions[widgetId].width = Math.round(size.width);
            positions[widgetId].height = Math.round(size.height);
            positions[widgetId].widthPercent = parseFloat(((size.width / window.innerWidth) * 100).toFixed(2));
            positions[widgetId].heightPercent = parseFloat(((size.height / window.innerHeight) * 100).toFixed(2));
        }
        
        console.log('[WIDGET] Saved position:', widgetId, positions[widgetId]);
        
        // Save to localStorage
        localStorage.setItem('widgetPositions', JSON.stringify(positions));
        
        // Save to profile if logged in
        if (this.userProfileManager && this.userProfileManager.isUserLoggedIn()) {
            const user = this.userProfileManager.getCurrentUser();
            if (user && user.profile) {
                user.profile.widgetPositions = positions;
                
                // Get password for encryption
                const password = this.userProfileManager.getDecryptionPassword();
                if (password) {
                    this.userProfileManager.saveUserProfile(user.username, user.profile, password);
                }
            }
        }
    }

    // Initialize Quick Links Widget
    initQuickLinksWidget() {
        const quicklinksContent = document.getElementById('quicklinksContent');
        const linksGrid = document.getElementById('linksGrid');
        
        if (!quicklinksContent || !linksGrid) {
            this.log('[QUICKLINKS] Missing elements for initialization');
            return;
        }
        
        // Only move links if there are any in the old grid
        // (If loadSavedContent runs first, linksGrid will be empty)
        const linkItems = Array.from(linksGrid.querySelectorAll('.link-item'));
        if (linkItems.length > 0) {
            linkItems.forEach(item => {
                quicklinksContent.appendChild(item);
            });
            this.log('[QUICKLINKS] Moved', linkItems.length, 'default links to widget');
        }
        
        // Hide the old grid container
        const quickLinksOldContainer = document.querySelector('.quick-links');
        if (quickLinksOldContainer) {
            quickLinksOldContainer.style.display = 'none';
        }
        
        this.log('[QUICKLINKS] Widget initialized');
    }

    // Link Management Functions
    populateLinksManager() {
        const linksManager = document.getElementById('linksManager');
        if (!linksManager) {
            console.warn('[CUSTOMIZE] Links manager element not found');
            return;
        }

        // Get all current links from the quicklinks widget content
        const quicklinksContent = document.getElementById('quicklinksContent');
        const linkContainer = quicklinksContent || document.getElementById('linksGrid');
        if (!linkContainer) {
            console.warn('[CUSTOMIZE] Links container not found');
            return;
        }

        const links = Array.from(linkContainer.querySelectorAll('.link-item')).map((item, index) => {
            const link = item.querySelector('.link-card');
            const nameEl = link.querySelector('.link-name');
            const iconEl = link.querySelector('.link-icon');
            return {
                index: index,
                url: link.href || '#',
                name: nameEl ? nameEl.textContent : 'Link',
                icon: iconEl ? iconEl.className : 'fas fa-link'
            };
        });

        // Clear existing content
        linksManager.innerHTML = '';

        // Add each link to the manager
        links.forEach((linkData, index) => {
            const linkItem = this.createLinkManagerItem(linkData, index);
            linksManager.appendChild(linkItem);
        });

        this.log('[CUSTOMIZE] Populated links manager with', links.length, 'links');
    }

    createLinkManagerItem(linkData, index) {
        const item = document.createElement('div');
        item.className = 'link-edit-item';
        item.draggable = true;
        item.dataset.index = index;

        item.innerHTML = `
            <div class="link-edit-main">
                <i class="fas fa-grip-vertical link-drag-handle"></i>
                <div class="link-edit-icon">
                    <i class="${linkData.icon}"></i>
                </div>
                <div class="link-edit-info">
                    <div class="link-edit-name">${this.escapeHtml(linkData.name)}</div>
                    <div class="link-edit-url">${this.escapeHtml(linkData.url)}</div>
                </div>
                <div class="link-edit-actions">
                    <button class="link-action-btn edit-btn" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="link-action-btn delete-btn" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="link-edit-form" id="editForm${index}">
                <div class="link-form-group">
                    <label>Link Name</label>
                    <input type="text" class="link-name-input" value="${this.escapeHtml(linkData.name)}" placeholder="Enter link name">
                </div>
                <div class="link-form-group">
                    <label>URL</label>
                    <input type="text" class="link-url-input" value="${this.escapeHtml(linkData.url)}" placeholder="https://example.com">
                </div>
                <div class="link-form-group">
                    <label>Icon Class (Font Awesome)</label>
                    <input type="text" class="link-icon-input" value="${this.escapeHtml(linkData.icon)}" placeholder="fas fa-link">
                </div>
                <div class="link-form-actions">
                    <button class="link-form-btn cancel">Cancel</button>
                    <button class="link-form-btn save">Save</button>
                </div>
            </div>
        `;

        // Edit button
        const editBtn = item.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => this.toggleLinkEditForm(index));

        // Delete button
        const deleteBtn = item.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => this.deleteLinkFromManager(index));

        // Form save button
        const saveBtn = item.querySelector('.link-form-btn.save');
        saveBtn.addEventListener('click', () => this.saveLinkEdit(index));

        // Form cancel button
        const cancelBtn = item.querySelector('.link-form-btn.cancel');
        cancelBtn.addEventListener('click', () => this.toggleLinkEditForm(index, false));

        // Drag events
        item.addEventListener('dragstart', (e) => this.handleLinkDragStart(e));
        item.addEventListener('dragover', (e) => this.handleLinkDragOver(e));
        item.addEventListener('drop', (e) => this.handleLinkDrop(e));
        item.addEventListener('dragend', (e) => this.handleLinkDragEnd(e));

        return item;
    }

    toggleLinkEditForm(index, show = null) {
        const form = document.getElementById(`editForm${index}`);
        if (!form) return;

        const isCurrentlyActive = form.classList.contains('active');
        
        // Close all other forms first
        document.querySelectorAll('.link-edit-form.active').forEach(f => {
            f.classList.remove('active');
        });

        // Toggle or set the state
        if (show === null) {
            if (!isCurrentlyActive) {
                form.classList.add('active');
            }
        } else if (show) {
            form.classList.add('active');
        }
    }

    saveLinkEdit(index) {
        const form = document.getElementById(`editForm${index}`);
        if (!form) return;

        const nameInput = form.querySelector('.link-name-input');
        const urlInput = form.querySelector('.link-url-input');
        const iconInput = form.querySelector('.link-icon-input');

        const newName = nameInput.value.trim();
        const newUrl = urlInput.value.trim();
        const newIcon = iconInput.value.trim();

        if (!newName || !newUrl) {
            alert('Name and URL are required.');
            return;
        }

        // Validate and format URL
        let validUrl = newUrl;
        if (!validUrl.startsWith('http://') && 
            !validUrl.startsWith('https://') && 
            !validUrl.startsWith('whatsapp://') &&
            !validUrl.startsWith('file:///') &&
            !validUrl.includes('://')) {
            validUrl = 'https://' + validUrl;
        }

        // Update the actual link in the quicklinks widget
        const quicklinksContent = document.getElementById('quicklinksContent');
        const linkContainer = quicklinksContent || document.getElementById('linksGrid');
        const linkItems = linkContainer.querySelectorAll('.link-item');
        
        if (linkItems[index]) {
            const linkCard = linkItems[index].querySelector('.link-card');
            const nameEl = linkCard.querySelector('.link-name');
            const iconEl = linkCard.querySelector('.link-icon');

            linkCard.href = validUrl;
            nameEl.textContent = newName;
            // Set icon class, ensuring link-icon is preserved
            const cleanIcon = newIcon.split(' ').filter(c => c !== 'link-icon').join(' ').trim() || 'fas fa-link';
            iconEl.className = cleanIcon + ' link-icon';

            // Update the manager item in real-time (before refreshing)
            const managerItem = document.querySelector(`.link-edit-item[data-index="${index}"]`);
            if (managerItem) {
                const managerName = managerItem.querySelector('.link-edit-name');
                const managerUrl = managerItem.querySelector('.link-edit-url');
                const managerIcon = managerItem.querySelector('.link-edit-icon i');
                
                if (managerName) managerName.textContent = newName;
                if (managerUrl) managerUrl.textContent = validUrl;
                if (managerIcon) managerIcon.className = newIcon || 'fas fa-link';
            }

            // Save changes
            this.saveContent();

            // Close the form
            this.toggleLinkEditForm(index, false);

            // Refresh the manager to update indices
            setTimeout(() => {
                this.populateLinksManager();
            }, 100);

            this.log('[CUSTOMIZE] Link updated:', { name: newName, url: validUrl, icon: newIcon });
        }
    }

    deleteLinkFromManager(index) {
        if (!confirm('Are you sure you want to delete this link?')) {
            return;
        }

        const quicklinksContent = document.getElementById('quicklinksContent');
        const linkContainer = quicklinksContent || document.getElementById('linksGrid');
        const linkItems = linkContainer.querySelectorAll('.link-item');

        if (linkItems[index]) {
            linkItems[index].remove();
            this.saveContent();
            this.updateGridLayout();
            this.populateLinksManager();

            this.log('[CUSTOMIZE] Link deleted at index:', index);
        }
    }

    // Drag and drop handlers for reordering
    handleLinkDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.innerHTML);
        this.draggedLinkIndex = parseInt(e.target.dataset.index);
    }

    handleLinkDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        
        const draggingItem = document.querySelector('.link-edit-item.dragging');
        const targetItem = e.target.closest('.link-edit-item');
        
        if (targetItem && targetItem !== draggingItem && draggingItem) {
            const linksManager = document.getElementById('linksManager');
            const allItems = Array.from(linksManager.querySelectorAll('.link-edit-item'));
            const draggingIndex = allItems.indexOf(draggingItem);
            const targetIndex = allItems.indexOf(targetItem);
            
            if (draggingIndex !== -1 && targetIndex !== -1) {
                if (draggingIndex < targetIndex) {
                    targetItem.parentNode.insertBefore(draggingItem, targetItem.nextSibling);
                } else {
                    targetItem.parentNode.insertBefore(draggingItem, targetItem);
                }
                
                // Show Apply button immediately when order changes
                const applyBtn = document.getElementById('applyLinkOrderBtn');
                if (applyBtn) {
                    applyBtn.style.display = 'block';
                }
            }
        }
        
        return false;
    }

    handleLinkDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        if (e.preventDefault) {
            e.preventDefault();
        }

        const targetElement = e.target.closest('.link-edit-item');
        if (!targetElement) return false;

        // Show the Apply button when order changes
        const applyBtn = document.getElementById('applyLinkOrderBtn');
        if (applyBtn) {
            applyBtn.style.display = 'block';
        }

        return false;
    }

    handleLinkDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedLinkIndex = null;
    }

    applyNewLinkOrder() {
        const quicklinksContent = document.getElementById('quicklinksContent');
        const linkContainer = quicklinksContent || document.getElementById('linksGrid');
        const linksManager = document.getElementById('linksManager');
        
        // Get link data from the manager in visual order (after drag)
        const managerItems = Array.from(linksManager.querySelectorAll('.link-edit-item'));
        const reorderedLinks = managerItems.map((item) => {
            const nameEl = item.querySelector('.link-edit-name');
            const urlEl = item.querySelector('.link-edit-url');
            const iconEl = item.querySelector('.link-edit-icon i');
            return {
                url: urlEl ? urlEl.textContent : '#',
                name: nameEl ? nameEl.textContent : 'Link',
                icon: iconEl ? iconEl.className : 'fas fa-link'
            };
        });

        // Clear and rebuild the container with the new order
        linkContainer.innerHTML = '';
        reorderedLinks.forEach(linkData => {
            // For quicklinks widget, add to linksGrid which will redirect to widget
            this.createLinkElement(document.getElementById('linksGrid'), linkData.url, linkData.name, linkData.icon);
        });

        // Save changes
        this.saveContent();
        this.updateGridLayout();

        // Refresh the manager with new indices
        this.populateLinksManager();

        // Hide the Apply button
        const applyBtn = document.getElementById('applyLinkOrderBtn');
        if (applyBtn) {
            applyBtn.style.display = 'none';
        }

        this.log('[CUSTOMIZE] Links reordered successfully');
    }

    toggleWeatherEffects(enabled) {
        this.weatherEffectsEnabled = enabled;
        localStorage.setItem('weatherEffectsEnabled', this.weatherEffectsEnabled);
        
        // If on a weather theme, re-apply it with or without effects
        if (this.currentTheme === 'weather' || this.currentTheme === 'weather-dark') {
            this.removeWeatherEffects();
            if (this.weatherEffectsEnabled) {
                this.applyWeatherTheme(this.currentTheme === 'weather-dark');
            } else {
                // Just apply gradient without effects
                this.applyWeatherTheme(this.currentTheme === 'weather-dark', true);
            }
        } else {
            // Regular theme - just add or remove effects
            if (this.weatherEffectsEnabled) {
                this.applyWeatherEffectsOnly();
            } else {
                this.removeWeatherEffects();
            }
        }
        this.log('[CUSTOMIZE] Weather effects toggled:', enabled);
    }

    toggleWeatherClouds(enabled) {
        this.weatherCloudsEnabled = enabled;
        localStorage.setItem('weatherCloudsEnabled', this.weatherCloudsEnabled);
        
        // Re-apply weather elements independently
        if (this.currentTheme === 'weather' || this.currentTheme === 'weather-dark') {
            this.removeWeatherEffects();
            this.applyWeatherTheme(this.currentTheme === 'weather-dark');
        } else if (this.weatherEffectsEnabled || this.weatherCloudsEnabled) {
            // Re-apply effects or elements that are enabled
            this.removeWeatherEffects();
            this.applyWeatherEffectsOnly();
        }
        this.log('[CUSTOMIZE] Weather clouds toggled:', enabled);
    }

    toggleWeatherWidgetFrost(enabled) {
        this.weatherWidgetFrostEnabled = enabled;
        localStorage.setItem('weatherWidgetFrostEnabled', this.weatherWidgetFrostEnabled);
        
        const widget = document.querySelector('.weather-widget');
        if (widget) {
            if (enabled) {
                widget.style.backdropFilter = 'blur(20px)';
                widget.style.background = '';
            } else {
                widget.style.backdropFilter = 'none';
                widget.style.background = 'transparent';
            }
        }
        
        this.log('[CUSTOMIZE] Weather widget frost toggled:', enabled);
    }

    toggleRemindersWidgetFrost(enabled) {
        this.remindersWidgetFrostEnabled = enabled;
        localStorage.setItem('remindersWidgetFrostEnabled', this.remindersWidgetFrostEnabled);
        
        const widget = document.querySelector('.reminder-widget');
        if (widget) {
            if (enabled) {
                widget.style.backdropFilter = 'blur(20px)';
                widget.style.background = '';
            } else {
                widget.style.backdropFilter = 'none';
                widget.style.background = 'transparent';
            }
        }
        
        this.log('[CUSTOMIZE] Reminders widget frost toggled:', enabled);
    }

    toggleQuicklinksWidgetFrost(enabled) {
        this.quicklinksWidgetFrostEnabled = enabled;
        localStorage.setItem('quicklinksWidgetFrostEnabled', this.quicklinksWidgetFrostEnabled);
        
        const widget = document.querySelector('.quicklinks-widget');
        if (widget) {
            if (enabled) {
                widget.style.backdropFilter = 'blur(20px)';
                widget.style.background = '';
            } else {
                widget.style.backdropFilter = 'none';
                widget.style.background = 'transparent';
            }
        }
        
        this.log('[CUSTOMIZE] Quick Links widget frost toggled:', enabled);
    }

    handleWeatherRefreshChange(value) {
        const customIntervalInput = document.getElementById('customizeCustomIntervalInput');
        const customIntervalValue = document.getElementById('customizeCustomIntervalValue');
        const customIntervalUnit = document.getElementById('customizeCustomIntervalUnit');
        
        if (value === 'custom') {
            if (customIntervalInput) {
                customIntervalInput.style.display = 'block';
                
                // Setup listeners for custom interval if not already done
                if (customIntervalValue && customIntervalUnit && !customIntervalValue.dataset.initialized) {
                    const applyCustomInterval = () => {
                        const val = parseInt(customIntervalValue.value);
                        const unit = customIntervalUnit.value;
                        
                        if (val && val > 0) {
                            // Convert to minutes
                            const minutes = unit === 'seconds' ? val / 60 : val;
                            this.weatherRefreshInterval = minutes;
                            this.saveWeatherRefreshInterval(minutes);
                            this.setupWeatherRefresh();
                        }
                    };
                    
                    customIntervalValue.addEventListener('change', applyCustomInterval);
                    customIntervalUnit.addEventListener('change', applyCustomInterval);
                    customIntervalValue.dataset.initialized = 'true';
                }
            }
        } else {
            if (customIntervalInput) {
                customIntervalInput.style.display = 'none';
            }
            this.weatherRefreshInterval = parseInt(value);
            this.saveWeatherRefreshInterval(this.weatherRefreshInterval);
            this.setupWeatherRefresh();
        }
        this.log('[CUSTOMIZE] Weather refresh interval changed to:', value);
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!username || !password) {
            this.showAuthMessage('Please fill in all fields', 'error');
            return;
        }

        this.showAuthMessage('Logging in...', 'info');
        
        try {
            // Check if there's pending import customizations (encrypted)
            const encryptedImport = sessionStorage.getItem('pendingImport_enc');
            const tempKey = sessionStorage.getItem('pendingImport_key');
            let importCustomizations = null;
            
            if (encryptedImport && tempKey) {
                try {
                    const decryptedData = await this.userProfileManager.cryptoUtils.decrypt(encryptedImport, tempKey);
                    const importData = JSON.parse(decryptedData);
                    if (importData.profile && importData.profile.username === username) {
                        importCustomizations = importData.customizations;
                    }
                } catch (e) {
                    console.error('Failed to decrypt import customizations:', e);
                }
            }
            
            const result = await this.userProfileManager.loginUser(username, password, rememberMe);
            
            if (result.success) {
                // Apply imported customizations if available
                if (importCustomizations) {
                    this.applyImportedCustomizations(importCustomizations);
                }
                
                this.showAuthMessage('Login successful!', 'success');
                setTimeout(() => {
                    this.updateUIForLoggedInUser();
                    this.loadUserProfile();
                    this.closeProfilePanelFn();
                }, 1500);
            } else {
                // Enhanced error message with recovery instructions
                let errorMsg = result.error;
                if (result.error.includes('Invalid password') || result.error.includes('not found')) {
                    errorMsg += '\n\nIf you deleted cookies/browser data, you may need to re-register.';
                }
                this.showAuthMessage(errorMsg, 'error');
            }
        } catch (error) {
            this.showAuthMessage('Login failed: ' + error.message, 'error');
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const displayName = document.getElementById('registerDisplayName').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (!username || !email || !password || !confirmPassword) {
            this.showAuthMessage('Please fill in all required fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showAuthMessage('Passwords do not match', 'error');
            return;
        }

        this.showAuthMessage('Creating account...', 'info');
        
        try {
            const result = await this.userProfileManager.registerUser(username, password, email, displayName);
            
            if (result.success) {
                this.showAuthMessage('Account created successfully!', 'success');
                setTimeout(() => {
                    this.updateUIForLoggedInUser();
                    this.loadUserProfile();
                    this.closeProfilePanelFn();
                }, 1500);
            } else {
                this.showAuthMessage(result.error, 'error');
            }
        } catch (error) {
            // Handle corrupted username error
            if (error.message === 'USERNAME_CORRUPTED') {
                this.showAuthMessage(
                    'This username has corrupted data. Click below to reclaim it.',
                    'error'
                );
                this.showReclaimButton(username, password, email, displayName);
            } else {
                this.showAuthMessage('Registration failed: ' + error.message, 'error');
            }
        }
    }

    showReclaimButton(username, password, email, displayName) {
        const authMessage = document.getElementById('authMessage');
        const reclaimBtn = document.createElement('button');
        reclaimBtn.textContent = 'Reclaim Username & Overwrite Old Data';
        reclaimBtn.className = 'edit-button';
        reclaimBtn.style.marginTop = '10px';
        reclaimBtn.style.width = '100%';
        
        reclaimBtn.onclick = async () => {
            this.showAuthMessage('Reclaiming username...', 'info');
            reclaimBtn.remove();
            
            try {
                const result = await this.userProfileManager.registerUser(
                    username, password, email, displayName, true // forceOverwrite = true
                );
                
                if (result.success) {
                    this.showAuthMessage('Username reclaimed! Account created successfully!', 'success');
                    setTimeout(() => {
                        this.updateUIForLoggedInUser();
                        this.loadUserProfile();
                        this.closeProfilePanelFn();
                    }, 1500);
                } else {
                    this.showAuthMessage(result.error, 'error');
                }
            } catch (error) {
                this.showAuthMessage('Failed to reclaim username: ' + error.message, 'error');
            }
        };
        
        authMessage.appendChild(reclaimBtn);
    }

    async handleLogout() {
        try {
            const result = await this.userProfileManager.logoutUser();
            if (result.success) {
                this.updateUIForLoggedOutUser();
                this.closeProfilePanelFn();
                this.showSaveNotification('Logged out successfully');
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    async handleClearAccountData() {
        const username = document.getElementById('loginUsername').value.trim();
        
        if (!username) {
            this.showAuthMessage('Please enter the username you want to clear', 'error');
            return;
        }

        const confirmed = confirm(
            `WARNING: This will permanently delete all data for username "${username}".\n\n` +
            `This action cannot be undone!\n\n` +
            `Are you sure you want to continue?`
        );

        if (!confirmed) return;

        try {
            // Clear all data for this username
            const profileKey = `profile_${username}`;
            localStorage.removeItem(profileKey);
            
            // Clear cookies
            this.userProfileManager.cryptoUtils.deleteCookie(profileKey);
            this.userProfileManager.cryptoUtils.deleteEncryptedCookie(profileKey);
            
            this.showAuthMessage('Account data cleared. You can now register with this username.', 'success');
            
            // Clear the form
            document.getElementById('loginUsername').value = '';
            document.getElementById('loginPassword').value = '';
        } catch (error) {
            console.error('Clear account error:', error);
            this.showAuthMessage('Failed to clear account data: ' + error.message, 'error');
        }
    }

    async loadUserProfile() {
        const user = this.userProfileManager.getCurrentUser();
        if (!user) return;

        // Ensure user has settings object with defaults
        if (!user.settings) {
            user.settings = {
                autoSync: false,
                syncInterval: 300000,
                storageMode: 'browser'
            };
        }

        // Update profile display
        const userAvatar = document.getElementById('userAvatar');
        const userDisplayName = document.getElementById('userDisplayName');
        const userUsername = document.getElementById('userUsername');
        const userEmail = document.getElementById('userEmail');
        const autoSyncToggle = document.getElementById('autoSyncToggle');
        const syncInterval = document.getElementById('syncInterval');
        const lastSyncTime = document.getElementById('lastSyncTime');
        const storageMode = document.getElementById('storageMode');
        const currentStoragePath = document.getElementById('currentStoragePath');
        const dataSize = document.getElementById('dataSize');
        const storagePath = document.getElementById('storagePath');
        
        // Update profile fields
        const updateDisplayName = document.getElementById('updateDisplayName');
        const updateEmail = document.getElementById('updateEmail');

        if (userAvatar) userAvatar.src = user.avatar || '';
        if (userDisplayName) userDisplayName.textContent = user.displayName || user.username || 'User';
        if (userUsername) userUsername.textContent = `@${user.username || 'username'}`;
        if (userEmail) userEmail.textContent = user.email || 'No email set';
        
        // Populate update fields with current values or empty string
        if (updateDisplayName) updateDisplayName.value = user.displayName || user.username || '';
        if (updateEmail) updateEmail.value = user.email || '';
        
        // Load sync settings from localStorage or user object
        const customizationSettings = JSON.parse(localStorage.getItem('customizationSettings') || '{}');
        this.log('[SYNC] Loading sync settings:', customizationSettings);
        const autoSyncValue = customizationSettings.autoSync !== undefined ? customizationSettings.autoSync : user.settings.autoSync;
        const syncIntervalValue = customizationSettings.syncInterval || user.settings.syncInterval;
        const storageModeValue = customizationSettings.storageMode || user.settings.storageMode || 'browser';
        
        this.log('[SYNC] Loaded values - autoSync:', autoSyncValue, 'interval:', syncIntervalValue, 'storage:', storageModeValue);
        
        // Update user object with loaded settings
        user.settings.autoSync = autoSyncValue;
        user.settings.syncInterval = parseInt(syncIntervalValue);
        user.settings.storageMode = storageModeValue;
        
        if (autoSyncToggle) {
            autoSyncToggle.checked = autoSyncValue;
            this.log('[SYNC] Set autoSyncToggle.checked to', autoSyncValue);
        }
        if (syncInterval) {
            syncInterval.value = syncIntervalValue;
            this.log('[SYNC] Set syncInterval.value to', syncIntervalValue);
        }
        if (lastSyncTime) {
            lastSyncTime.textContent = user.lastSync 
                ? new Date(user.lastSync).toLocaleString()
                : 'Never';
        }

        // Update storage settings
        if (storageMode) storageMode.value = storageModeValue;

        // Update storage info
        try {
            const storageInfo = await this.userProfileManager.getStorageInfo();
            this.log('[PROFILE] Storage info:', storageInfo);
            if (currentStoragePath) currentStoragePath.textContent = storageInfo.path || 'Browser Default';
            if (dataSize) dataSize.textContent = storageInfo.size || '0 B';
            if (storagePath) storagePath.textContent = storageInfo.location || 'localStorage (browser)';
        } catch (error) {
            console.error('[PROFILE] Error getting storage info:', error);
            if (dataSize) dataSize.textContent = '0 B';
            if (currentStoragePath) currentStoragePath.textContent = 'Browser Default';
            if (storagePath) storagePath.textContent = 'localStorage (browser)';
        }

        // Apply user preferences to app
        await this.userProfileManager.applyProfileToApp(user);
        
        // Update sync status
        this.updateSyncStatus();
    }

    updateUIForLoggedInUser() {
        if (this.profileBtn) {
            this.profileBtn.classList.add('logged-in');
            this.profileBtn.title = 'User Profile (Logged In)';
        }
        if (this.profileIndicator) {
            this.profileIndicator.classList.remove('offline');
            this.profileIndicator.classList.add('online');
        }
        if (this.syncBtn) {
            this.syncBtn.style.display = 'flex';
        }
    }

    updateUIForLoggedOutUser() {
        if (this.profileBtn) {
            this.profileBtn.classList.remove('logged-in');
            this.profileBtn.title = 'User Profile (Not Logged In)';
        }
        if (this.profileIndicator) {
            this.profileIndicator.classList.remove('online', 'syncing');
            this.profileIndicator.classList.add('offline');
        }
        if (this.syncBtn) {
            this.syncBtn.style.display = 'none';
        }
    }

    showAuthForm() {
        const authForm = document.getElementById('authForm');
        const profileDisplay = document.getElementById('profileDisplay');
        
        if (authForm) authForm.style.display = 'block';
        if (profileDisplay) profileDisplay.style.display = 'none';
        
        // Clear form fields
        document.querySelectorAll('.profile-input').forEach(input => input.value = '');
    }

    showProfileDisplay() {
        const authForm = document.getElementById('authForm');
        const profileDisplay = document.getElementById('profileDisplay');
        
        if (authForm) authForm.style.display = 'none';
        if (profileDisplay) profileDisplay.style.display = 'block';
    }

    showAuthMessage(message, type) {
        const authMessage = document.getElementById('authMessage');
        if (authMessage) {
            authMessage.textContent = message;
            authMessage.className = `auth-message ${type}`;
            authMessage.style.display = 'block';
        }
    }

    clearAuthMessage() {
        const authMessage = document.getElementById('authMessage');
        if (authMessage) {
            authMessage.style.display = 'none';
        }
    }

    // Profile Dropdown Methods
    toggleProfileDropdown() {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) {
            dropdown.classList.toggle('show');
        }
    }

    closeProfileDropdown() {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    async performManualSync() {
        if (!this.userProfileManager.isUserLoggedIn()) return;

        this.setSyncingState(true);
        
        try {
            // Refresh weather data first
            await this.refreshWeatherData();
            
            // Then sync user data
            const result = await this.userProfileManager.syncUserData();
            if (result.success) {
                this.showSaveNotification('Sync completed successfully');
                this.updateSyncStatus();
                this.updateRefreshTooltip(); // Update tooltip after sync
            } else {
                this.showSaveNotification('Sync failed: ' + result.error);
            }
        } catch (error) {
            console.error('Manual sync error:', error);
            this.showSaveNotification('Sync failed');
        }
        
        setTimeout(() => this.setSyncingState(false), 1000);
    }

    setSyncingState(syncing) {
        if (this.syncBtn) {
            if (syncing) {
                this.syncBtn.classList.add('syncing');
                this.syncBtn.title = 'Syncing...';
            } else {
                this.syncBtn.classList.remove('syncing');
                this.syncBtn.title = 'Sync Settings';
            }
        }
        
        if (this.profileIndicator) {
            if (syncing) {
                this.profileIndicator.classList.add('syncing');
            } else {
                this.profileIndicator.classList.remove('syncing');
            }
        }
    }

    updateSyncStatus() {
        const syncStatus = this.userProfileManager.getSyncStatus();
        const lastSyncTime = document.getElementById('lastSyncTime');
        
        if (lastSyncTime && syncStatus.lastSync) {
            lastSyncTime.textContent = new Date(syncStatus.lastSync).toLocaleString();
        }
        
        this.updateRefreshTooltip();
    }

    updateRefreshTooltip() {
        const refreshBtn = document.getElementById('refreshBtn');
        const syncStatus = this.userProfileManager.getSyncStatus();
        
        if (refreshBtn && syncStatus.lastSync) {
            const lastSync = new Date(syncStatus.lastSync);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastSync) / 60000);
            
            let timeAgo;
            if (diffMinutes < 1) {
                timeAgo = 'just now';
            } else if (diffMinutes < 60) {
                timeAgo = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
            } else {
                const diffHours = Math.floor(diffMinutes / 60);
                timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            }
            
            refreshBtn.title = `Last refresh: ${timeAgo}`;
        } else if (refreshBtn) {
            refreshBtn.title = 'Last refresh: Never';
        }
    }

    async toggleAutoSync(enabled) {
        try {
            const result = await this.userProfileManager.toggleSync(enabled);
            if (result.success) {
                // Save to localStorage
                const customizationSettings = JSON.parse(localStorage.getItem('customizationSettings') || '{}');
                customizationSettings.autoSync = enabled;
                localStorage.setItem('customizationSettings', JSON.stringify(customizationSettings));
                this.log('[SYNC] Saved autoSync to localStorage:', enabled, customizationSettings);
                
                this.showSaveNotification(`Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
            }
        } catch (error) {
            console.error('Toggle sync error:', error);
        }
    }

    async updateSyncInterval(interval) {
        if (!this.userProfileManager.isUserLoggedIn()) return;
        
        try {
            const user = this.userProfileManager.getCurrentUser();
            user.settings.syncInterval = parseInt(interval);
            await this.userProfileManager.updateProfile({ settings: user.settings });
            
            // Save to localStorage to persist on restart
            const customizationSettings = JSON.parse(localStorage.getItem('customizationSettings') || '{}');
            customizationSettings.syncInterval = interval;
            localStorage.setItem('customizationSettings', JSON.stringify(customizationSettings));
            this.log('[SYNC] Saved syncInterval to localStorage:', interval, customizationSettings);
            
            this.showSaveNotification('Sync interval updated');
        } catch (error) {
            console.error('Update interval error:', error);
        }
    }

    enableProfileEdit() {
        const updateDisplayName = document.getElementById('updateDisplayName');
        const updateEmail = document.getElementById('updateEmail');
        const updatePassword = document.getElementById('updatePassword');
        const updatePasswordGroup = document.getElementById('updatePasswordGroup');
        const updateProfileBtn = document.getElementById('updateProfileBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const editProfileBtn = document.getElementById('editProfileBtn');
        
        if (updateDisplayName) updateDisplayName.removeAttribute('readonly');
        if (updateEmail) updateEmail.removeAttribute('readonly');
        if (updatePasswordGroup) updatePasswordGroup.style.display = 'block';
        if (updatePassword) updatePassword.value = ''; // Clear password field
        if (updateProfileBtn) updateProfileBtn.style.display = 'block';
        if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
        if (editProfileBtn) editProfileBtn.style.display = 'none';
        
        // Focus on first input
        if (updateDisplayName) updateDisplayName.focus();
    }

    disableProfileEdit() {
        const updateDisplayName = document.getElementById('updateDisplayName');
        const updateEmail = document.getElementById('updateEmail');
        const updatePassword = document.getElementById('updatePassword');
        const updatePasswordGroup = document.getElementById('updatePasswordGroup');
        const updateProfileBtn = document.getElementById('updateProfileBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const editProfileBtn = document.getElementById('editProfileBtn');
        
        if (updateDisplayName) updateDisplayName.setAttribute('readonly', true);
        if (updateEmail) updateEmail.setAttribute('readonly', true);
        if (updatePasswordGroup) updatePasswordGroup.style.display = 'none';
        if (updatePassword) updatePassword.value = ''; // Clear password field
        if (updateProfileBtn) updateProfileBtn.style.display = 'none';
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';
        if (editProfileBtn) editProfileBtn.style.display = 'inline-flex';
        
        // Reload values from profile
        this.loadUserProfile();
    }

    async handleUpdateProfile() {
        if (!this.userProfileManager.isUserLoggedIn()) return;
        
        try {
            const displayNameInput = document.getElementById('updateDisplayName');
            const emailInput = document.getElementById('updateEmail');
            const passwordInput = document.getElementById('updatePassword');
            const displayName = displayNameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            
            const user = this.userProfileManager.getCurrentUser();
            
            // Check if there are actual changes
            const hasChanges = (displayName && displayName !== user.displayName) || 
                              (email && email !== user.email);
            
            if (!hasChanges) {
                this.showAuthMessage('No changes to save', 'info');
                return;
            }
            
            // Require password for any changes
            if (!password) {
                this.showAuthMessage('Please enter your current password to save changes', 'error');
                passwordInput.focus();
                return;
            }
            
            // Validate email if provided and changed
            if (email && email !== user.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    this.showAuthMessage('Please enter a valid email address', 'error');
                    return;
                }
            }
            
            // Validate display name if provided and changed
            if (displayName && displayName !== user.displayName && displayName.length < 3) {
                this.showAuthMessage('Display name must be at least 3 characters', 'error');
                return;
            }
            
            // Verify password before updating
            const isPasswordValid = await this.userProfileManager.verifyPassword(user.username, password);
            if (!isPasswordValid) {
                this.showAuthMessage('Incorrect password. Please try again.', 'error');
                passwordInput.value = '';
                passwordInput.focus();
                return;
            }
            
            const updates = {};
            if (displayName && displayName !== user.displayName) updates.displayName = displayName;
            if (email && email !== user.email) updates.email = email;
            
            const result = await this.userProfileManager.updateProfile(updates, password);
            
            if (result.success) {
                this.showSaveNotification('Profile updated successfully');
                // Refresh the display
                await this.loadUserProfile();
                // Disable edit mode
                this.disableProfileEdit();
            } else {
                this.showAuthMessage(result.error || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Update profile error:', error);
            this.showAuthMessage('Failed to update profile', 'error');
        }
    }

    async handleAvatarChange(event) {
        if (!this.userProfileManager.isUserLoggedIn()) return;
        
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showAuthMessage('Please select a valid image file', 'error');
            return;
        }
        
        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            this.showAuthMessage('Image size must be less than 2MB', 'error');
            return;
        }
        
        try {
            // Read file as data URL
            const reader = new FileReader();
            reader.onload = async (e) => {
                const avatarData = e.target.result;
                
                // Update profile with new avatar
                const result = await this.userProfileManager.updateProfile({ avatar: avatarData });
                
                if (result.success) {
                    // Update UI immediately
                    const userAvatar = document.getElementById('userAvatar');
                    if (userAvatar) userAvatar.src = avatarData;
                    
                    this.showSaveNotification('Avatar updated successfully');
                } else {
                    this.showAuthMessage(result.error || 'Failed to update avatar', 'error');
                }
            };
            
            reader.onerror = () => {
                this.showAuthMessage('Failed to read image file', 'error');
            };
            
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Avatar change error:', error);
            this.showAuthMessage('Failed to update avatar', 'error');
        }
    }

    async exportUserData() {
        if (!this.userProfileManager.isUserLoggedIn()) return;

        try {
            const user = this.userProfileManager.getCurrentUser();
            
            // Gather all user customizations
            const newTabContent = localStorage.getItem('newTabContent');
            const selectedTheme = localStorage.getItem('selectedTheme');
            const reminders = localStorage.getItem('reminders');
            const weatherEffectsEnabled = localStorage.getItem('weatherEffectsEnabled');
            const weatherCloudsEnabled = localStorage.getItem('weatherCloudsEnabled');
            
            const dataToExport = {
                profile: user,
                customizations: {
                    newTabContent: newTabContent ? JSON.parse(newTabContent) : null,
                    selectedTheme: selectedTheme || 'ocean',
                    reminders: reminders ? JSON.parse(reminders) : [],
                    weatherLocation: document.getElementById('weatherLocation')?.textContent || 'New York',
                    // greeting is NOT exported - always based on time/season/weather
                    linksTitle: document.querySelector('.links-title')?.textContent || 'Quick Links',
                    weatherEffectsEnabled: weatherEffectsEnabled === 'true',
                    weatherCloudsEnabled: weatherCloudsEnabled === 'true',
                    weatherRefreshInterval: this.weatherRefreshInterval || 30
                },
                exportDate: new Date().toISOString(),
                version: '2.0'
            };

            const dataStr = JSON.stringify(dataToExport, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `nitrogen-account-${user.username}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showSaveNotification('Account data exported successfully');
        } catch (error) {
            console.error('Export error:', error);
            this.showSaveNotification('Export failed');
        }
    }

    handleImportAccount() {
        // Trigger file input for importing account from login screen
        const importFileInput = document.getElementById('importFileInput');
        if (importFileInput) {
            // Set a data attribute to indicate this is an account import (not profile data import)
            importFileInput.dataset.importType = 'account';
            importFileInput.click();
        }
    }

    importUserData() {
        const importFileInput = document.getElementById('importFileInput');
        if (importFileInput) {
            // Set import type to profile data
            importFileInput.dataset.importType = 'profile';
            importFileInput.click();
        }
    }

    async handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const importType = event.target.dataset.importType || 'profile';

        try {
            // Use FileReader for better compatibility across environments
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(new Error('Failed to read file'));
                reader.readAsText(file);
            });
            const importData = JSON.parse(text);
            
            if (importData.profile && importData.version) {
                if (importType === 'account') {
                    // Import account - this includes encrypted user credentials and settings
                    const result = await this.userProfileManager.importAccount(importData);
                    if (result.success) {
                        // Apply customizations after successful account import
                        if (importData.customizations) {
                            this.applyImportedCustomizations(importData.customizations);
                        }
                        
                        // Pre-fill the username in login form
                        const loginUsernameInput = document.getElementById('loginUsername');
                        if (loginUsernameInput && importData.profile.username) {
                            loginUsernameInput.value = importData.profile.username;
                        }
                        
                        // Show login tab
                        this.showTab('login');
                        
                        this.showAuthMessage('Account imported successfully! Please enter your password to login.', 'success');
                    } else {
                        this.showAuthMessage(result.error || 'Failed to import account', 'error');
                    }
                } else {
                    // Import profile data only (for logged-in users)
                    await this.userProfileManager.applyProfileToApp(importData.profile);
                    
                    // Apply customizations if available
                    if (importData.customizations) {
                        this.applyImportedCustomizations(importData.customizations);
                    }
                    
                    this.loadUserProfile();
                    this.showSaveNotification('Profile and settings imported successfully');
                    this.closeProfilePanelFn();
                }
            } else {
                throw new Error('Invalid file format');
            }
        } catch (error) {
            console.error('Import error:', error);
            const message = importType === 'account' ? 'Failed to import account: Invalid file' : 'Import failed: Invalid file';
            if (importType === 'account') {
                this.showAuthMessage(message, 'error');
            } else {
                this.showSaveNotification(message);
            }
        }
        
        // Clear file input and import type
        event.target.value = '';
        delete event.target.dataset.importType;
    }

    applyImportedCustomizations(customizations) {
        try {
            // Apply theme
            if (customizations.selectedTheme) {
                localStorage.setItem('selectedTheme', customizations.selectedTheme);
                this.changeTheme(customizations.selectedTheme);
                if (this.themeSelect) {
                    this.themeSelect.value = customizations.selectedTheme;
                }
                // Also update customize tab theme selector
                const customizeThemeSelect = document.getElementById('customizeThemeSelect');
                if (customizeThemeSelect) {
                    customizeThemeSelect.value = customizations.selectedTheme;
                }
            }

            // Apply weather effects settings
            if (customizations.weatherEffectsEnabled !== undefined) {
                localStorage.setItem('weatherEffectsEnabled', customizations.weatherEffectsEnabled);
                this.weatherEffectsEnabled = customizations.weatherEffectsEnabled;
                const weatherEffectsToggle = document.getElementById('customizeWeatherEffectsToggle');
                if (weatherEffectsToggle) {
                    weatherEffectsToggle.checked = customizations.weatherEffectsEnabled;
                }
            }

            if (customizations.weatherCloudsEnabled !== undefined) {
                localStorage.setItem('weatherCloudsEnabled', customizations.weatherCloudsEnabled);
                this.weatherCloudsEnabled = customizations.weatherCloudsEnabled;
                const weatherCloudsToggle = document.getElementById('customizeWeatherCloudsToggle');
                if (weatherCloudsToggle) {
                    weatherCloudsToggle.checked = customizations.weatherCloudsEnabled;
                }
            }

            if (customizations.weatherRefreshInterval !== undefined) {
                this.weatherRefreshInterval = customizations.weatherRefreshInterval;
                this.saveWeatherRefreshInterval(customizations.weatherRefreshInterval);
                const weatherRefreshInterval = document.getElementById('customizeWeatherRefreshInterval');
                if (weatherRefreshInterval) {
                    weatherRefreshInterval.value = customizations.weatherRefreshInterval;
                }
            }

            // Apply new tab content (links, greeting, weather location)
            if (customizations.newTabContent) {
                localStorage.setItem('newTabContent', JSON.stringify(customizations.newTabContent));
                this.loadSavedContent();
            }

            // Apply individual customizations if newTabContent is not available
            if (customizations.weatherLocation) {
                const weatherLocationEl = document.getElementById('weatherLocation');
                if (weatherLocationEl) {
                    weatherLocationEl.textContent = customizations.weatherLocation;
                    // Fetch weather for imported location
                    this.fetchWeatherByCity(customizations.weatherLocation);
                }
            }

            if (customizations.greeting) {
                const greetingEl = document.getElementById('greeting');
                if (greetingEl) {
                    greetingEl.textContent = customizations.greeting;
                }
            }

            if (customizations.linksTitle) {
                const linksTitleEl = document.querySelector('.links-title');
                if (linksTitleEl) {
                    linksTitleEl.textContent = customizations.linksTitle;
                }
            }

            // Apply reminders
            if (customizations.reminders) {
                localStorage.setItem('reminders', JSON.stringify(customizations.reminders));
                this.reminders = customizations.reminders;
                this.renderReminders();
            }

        } catch (error) {
            console.error('Error applying customizations:', error);
        }
    }

    async handleStorageModeChange(mode) {
        // Save to localStorage to persist on restart
        const customizationSettings = JSON.parse(localStorage.getItem('customizationSettings') || '{}');
        customizationSettings.storageMode = mode;
        localStorage.setItem('customizationSettings', JSON.stringify(customizationSettings));
        this.log('[SYNC] Saved storageMode to localStorage:', mode, customizationSettings);
        
        // Apply change immediately
        await this.applyStorageModeChange(mode, '');
    }

    async applyStorageModeChange(mode, customPath) {
        if (!this.userProfileManager.isUserLoggedIn()) return;

        this.showAuthMessage('Updating storage location...', 'info');
        
        try {
            const result = await this.userProfileManager.changeStorageMode(mode, customPath);
            
            if (result.success) {
                this.showSaveNotification(result.message);
                
                // Update UI
                const currentStoragePath = document.getElementById('currentStoragePath');
                const dataSize = document.getElementById('dataSize');
                
                const storageInfo = await this.userProfileManager.getStorageInfo();
                if (currentStoragePath) currentStoragePath.textContent = storageInfo.path;
                if (dataSize) dataSize.textContent = storageInfo.size;
                
                this.clearAuthMessage();
            } else {
                this.showAuthMessage(result.error, 'error');
            }
        } catch (error) {
            console.error('Storage mode change error:', error);
            this.showAuthMessage('Failed to update storage location', 'error');
        }
    }

    // Add method to show storage location in profile display
    async updateStorageDisplay() {
        if (!this.userProfileManager.isUserLoggedIn()) return;
        
        const storageInfo = await this.userProfileManager.getStorageInfo();
        const currentStoragePath = document.getElementById('currentStoragePath');
        const dataSize = document.getElementById('dataSize');
        
        if (currentStoragePath) currentStoragePath.textContent = storageInfo.path;
        if (dataSize) dataSize.textContent = storageInfo.size;
    }
}

// Animation utilities
class AnimationUtils {
    static fadeInOnScroll() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        });

        document.querySelectorAll('section').forEach(section => {
            section.style.opacity = '0';
            section.style.transform = 'translateY(20px)';
            section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(section);
        });
    }

    static addHoverEffects() {
        // Add smooth hover effects to interactive elements
        const interactiveElements = document.querySelectorAll('.skill-item, .project-card, .contact-link');
        
        interactiveElements.forEach(element => {
            element.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-5px)';
            });
            
            element.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });
    }
}

// Theme utilities
class ThemeUtils {
    static initColorTheme() {
        // Add color theme switching capability
        const themes = {
            default: {
                primary: '#667eea',
                secondary: '#764ba2',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            },
            ocean: {
                primary: '#2196F3',
                secondary: '#21CBF3',
                background: 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)'
            },
            sunset: {
                primary: '#FF6B6B',
                secondary: '#FFE66D',
                background: 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%)'
            },
            forest: {
                primary: '#4CAF50',
                secondary: '#8BC34A',
                background: 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)'
            }
        };

        // Theme switcher could be added here
        window.changeTheme = function(themeName) {
            const theme = themes[themeName];
            if (theme) {
                document.documentElement.style.setProperty('--primary-color', theme.primary);
                document.documentElement.style.setProperty('--secondary-color', theme.secondary);
                document.body.style.background = theme.background;
            }
        };
    }
}

// Check for domain migration and offer to copy settings
// Global variable for access from onclick handlers
let newTabHomepage;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the new tab homepage
    try {
        newTabHomepage = new NewTabHomepage();
        window.newTabHomepage = newTabHomepage; // Make it globally accessible
        
        // Set initial grid layout based on existing links
        setTimeout(() => {
            newTabHomepage.updateGridLayout();
        }, 100);
    } catch (error) {
        console.error('Error initializing homepage:', error);
    }
    
    // Initialize animations
    AnimationUtils.fadeInOnScroll();
    
    // Initialize theme system
    ThemeUtils.initColorTheme();
    
    // Add some interactive features
    addInteractiveFeatures();
});

function addInteractiveFeatures() {
    // Add typing animation to the greeting (only on initial page load)
    const greeting = document.getElementById('greeting');
    let typewriterHasRun = false;
    
    function typeWriter(element, text, speed = 100) {
        // Only run once ever
        if (typewriterHasRun) return;
        typewriterHasRun = true;
        
        element.textContent = '';
        let i = 0;
        const timer = setInterval(() => {
            if (i < text.length) {
                element.textContent += text[i];
                i++;
            } else {
                clearInterval(timer);
            }
        }, speed);
    }
    
    // Trigger typing animation on page load (only once)
    if (greeting && greeting.textContent) {
        const originalText = greeting.textContent;
        setTimeout(() => {
            typeWriter(greeting, originalText, 80);
        }, 1500);
    }
    
    // Add floating animation to weather widget
    const weatherWidget = document.querySelector('.weather-widget');
    if (weatherWidget) {
        setInterval(() => {
            weatherWidget.style.transform = `translateY(${Math.sin(Date.now() * 0.001) * 3}px)`;
        }, 16);
    }
    
    // Add breathing animation to search container
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer) {
        searchContainer.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.02)';
        });
        
        searchContainer.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    }
}

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NewTabHomepage, AnimationUtils, ThemeUtils };
}
