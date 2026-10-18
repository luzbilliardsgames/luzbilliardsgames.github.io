// City of Crime — textos da página em PT/EN/ES (?lang=en|es ou idioma do navegador) e trailer do YouTube.
(function () {
    "use strict";
    var T = {
        en: {
            genre: "Action · Open-world multiplayer",
            title: "A whole city. No rules.",
            tagline: "Steal cars, escape a five-star police chase, take down the helicopter with a rocket launcher and build your ride with a booming sound system. With your friends, in real time.",
            play: "Download free on Google Play",
            watch: "▶ Watch the trailer",
            trailerTitle: "Trailer",
            featuresTitle: "What you can do in the city",
            f1t: "Five-star chases", f1: "Squad cars, roadblocks, spike strips and a helicopter on your tail. Run or fight back.",
            f2t: "Full arsenal", f2: "Pistol, SMG, assault rifle, sniper, flamethrower, grenades and a rocket launcher — even for the chopper.",
            f3t: "Garage and sound system", f3: "Lower it, swap wheels, paint, add decals, neon and LED speakers. Show it off in the community gallery.",
            f4t: "Steal any car", f4: "Pull the driver out, floor it, jump ramps on a motorcycle and explore by day, by night and in the rain.",
            f5t: "Top-down view", f5: "Switch to the classic top-down camera with one tap, on foot or behind the wheel.",
            f6t: "Real-time multiplayer", f6: "Public or private rooms with friends, missions, street events, gangs and a city full of life.",
            privacy: "City of Crime privacy policy", home: "All games",
            rights: "All rights reserved. Google Play is a trademark of Google LLC."
        },
        es: {
            genre: "Acción · Mundo abierto multijugador",
            title: "Una ciudad entera. Sin reglas.",
            tagline: "Roba autos, escapa de la policía con cinco estrellas, derriba el helicóptero con la bazuca y arma tu auto con un equipo de sonido brutal. Con tus amigos, en tiempo real.",
            play: "Descárgalo gratis en Google Play",
            watch: "▶ Ver tráiler",
            trailerTitle: "Tráiler",
            featuresTitle: "Lo que puedes hacer en la ciudad",
            f1t: "Persecuciones de 5 estrellas", f1: "Patrullas, barricadas, ponchallantas y un helicóptero detrás de ti. Huye o da la pelea.",
            f2t: "Arsenal completo", f2: "Pistola, subfusil, rifle, francotirador, lanzallamas, granadas y bazuca — hasta para el helicóptero.",
            f3t: "Taller y sonido", f3: "Tumba tu auto, cambia rines, pinta, pon calcomanías, neón y bocinas con LED. Preséntalo en la galería de la comunidad.",
            f4t: "Roba cualquier auto", f4: "Saca al conductor, acelera, salta rampas en moto y explora de día, de noche y bajo la lluvia.",
            f5t: "Vista desde arriba", f5: "Cambia a la cámara desde arriba de los clásicos con un toque, a pie o al volante.",
            f6t: "Multijugador en tiempo real", f6: "Salas públicas o privadas con amigos, misiones, eventos callejeros, pandillas y una ciudad llena de vida.",
            privacy: "Política de privacidad de City of Crime", home: "Todos los juegos",
            rights: "Todos los derechos reservados. Google Play es una marca de Google LLC."
        }
    };
    var q = (location.search.match(/[?&]lang=(pt|en|es)/) || [])[1];
    var nav = (navigator.language || "pt").slice(0, 2);
    var lang = q || (T[nav] ? nav : "pt");
    if (T[lang]) {
        document.documentElement.lang = lang === "en" ? "en" : "es";
        document.querySelectorAll("[data-i18n]").forEach(function (el) {
            var v = T[lang][el.getAttribute("data-i18n")];
            if (v) el.textContent = v;
        });
    }
    document.querySelectorAll("[data-lang]").forEach(function (a) {
        if (a.getAttribute("data-lang") === lang) a.setAttribute("aria-current", "true");
    });
    document.querySelectorAll("iframe[data-src]").forEach(function (f) {
        f.src = f.getAttribute("data-src");
    });
})();
