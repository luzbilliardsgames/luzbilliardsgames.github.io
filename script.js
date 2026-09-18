// Luz Billiards Games - trailer modal
(function () {
    'use strict';

    var modal = document.getElementById('videoModal');
    var player = document.getElementById('videoPlayer');
    var lastTrigger = null;

    function openVideo(btn) {
        lastTrigger = btn;
        player.poster = btn.getAttribute('data-poster') || '';
        player.src = btn.getAttribute('data-video');
        player.setAttribute('aria-label', btn.getAttribute('data-title') || 'Trailer');
        modal.hidden = false;
        document.body.classList.add('modal-open');
        modal.querySelector('.modal-close').focus();
        var p = player.play();
        if (p && typeof p.catch === 'function') {
            p.catch(function () { /* autoplay bloqueado: o usuário usa os controles */ });
        }
    }

    function closeVideo() {
        if (modal.hidden) return;
        player.pause();
        player.removeAttribute('src');
        player.load();
        modal.hidden = true;
        document.body.classList.remove('modal-open');
        if (lastTrigger) lastTrigger.focus();
    }

    document.querySelectorAll('[data-video]').forEach(function (btn) {
        btn.addEventListener('click', function () { openVideo(btn); });
    });

    modal.querySelectorAll('[data-close]').forEach(function (el) {
        el.addEventListener('click', closeVideo);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeVideo();
    });

    var year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());
})();
