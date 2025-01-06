// Define Base URL for resources
const BASE_PLUGIN_URL = chrome.runtime.getURL("/");

// Import necessary modules dynamically
const loadModules = async () => {
    const sessionModule = await import(BASE_PLUGIN_URL + "src/scripts/platform/session.js");
    const trackModule = await import(BASE_PLUGIN_URL + "src/scripts/platform/track.js");
    const cvScanModule = await import(BASE_PLUGIN_URL + "src/scripts/platform/cv-scan.js");
    const autoFillModule = await import(BASE_PLUGIN_URL + "src/scripts/platform/auto-fill.js");
    const resumeInfosModule = await import(BASE_PLUGIN_URL + "src/scripts/platform/resume-infos.js");
    const utilsModule = await import(BASE_PLUGIN_URL + "src/scripts/platform/utils.js");
    const viewsModule = await import(BASE_PLUGIN_URL + "src/scripts/platform/views.js");

    return {
        session: sessionModule.default,
        track: trackModule.default,
        cvScan: cvScanModule.default,
        autoFill: autoFillModule.default,
        resumeInfos: resumeInfosModule.default,
        utils: utilsModule.default,
        views: viewsModule.default,
    };
};

// Initialize application
const initializeExtension = async () => {
    try {
        const modules = await loadModules();

        // Fetch UI components
        const [mainButtonHTML, loaderIconHTML, logoSVG, closeIconHTML, pinIconHTML] = await Promise.all([
            fetch(BASE_PLUGIN_URL + "assets/ui/main-button.html").then(res => res.text()),
            fetch(BASE_PLUGIN_URL + "assets/ui/loader-icon.html").then(res => res.text()),
            fetch(BASE_PLUGIN_URL + "assets/ui/logo.svg").then(res => res.text()),
            fetch(BASE_PLUGIN_URL + "assets/ui/close-icon.html").then(res => res.text()),
            fetch(BASE_PLUGIN_URL + "assets/ui/pin-icon.html").then(res => res.text()),
        ]);

        // Define initial variables
        let apiToken = null;
        let currentView = null;
        let jobList = [];

        // Initialize session and track user interactions
        modules.session.init();
        modules.track.init();

        // Handle UI initialization
        modules.views.renderMainButton(mainButtonHTML);
        modules.views.renderLoader(loaderIconHTML);

        // Event Listeners
        document.addEventListener("click", (event) => {
            if (event.target.matches(".apply-job-btn")) {
                modules.cvScan.scanAndApplyJob(event.target.dataset.jobId);
            }
        });

        // Load jobs and inject UI components
        const jobs = await modules.utils.fetchJobs();
        jobs.forEach(job => {
            const jobElement = modules.views.createJobElement(job, logoSVG, closeIconHTML);
            document.body.appendChild(jobElement);
        });

        console.log("Extension initialized successfully.");

    } catch (error) {
        console.error("Error initializing extension:", error);
    }
};

// Start the extension
initializeExtension();
