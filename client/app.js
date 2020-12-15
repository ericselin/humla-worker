const installSw = async () => {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    if (registration.installing) {
      console.log("Service worker installing");
    } else if (registration.waiting) {
      console.log("Service worker installed");
    } else if (registration.active) {
      console.log("Service worker active");
    }
  } catch (error) {
    console.log("Registration failed with", error);
  }
};

if ("serviceWorker" in navigator) {
  installSw();
}
