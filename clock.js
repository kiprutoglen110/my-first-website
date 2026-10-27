
function updateClock() {
    const now = new Date();

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    const period = hours >= 12 ? "PM" : "AM";

    hours = hours % 12 || 12;
    const displayHours = String(hours).padStart(2, "0");

    document.getElementById("time").textContent =
        `${displayHours}:${minutes}:${seconds}`;

    document.getElementById("period").textContent = period;

    document.getElementById("date").textContent =
        new Intl.DateTimeFormat("en-KE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(now);

    const currentHour = now.getHours();
    let greeting;

    if (currentHour < 12) {
        greeting = "Good morning!";
    } else if (currentHour < 18) {
        greeting = "Good afternoon!";
    } else {
        greeting = "Good evening!";
    }

    document.getElementById("greeting").textContent = greeting;
}

updateClock();
setInterval(updateClock, 1000);
