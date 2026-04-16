const links = document.querySelectorAll(".nav-links a");
const current = window.location.pathname.split("/").pop();

links.forEach(link => {
    const href = link.getAttribute("href").split("/").pop();
    if (href === current) {
        link.classList.add("active");
    }
});