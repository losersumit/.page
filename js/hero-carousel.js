document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('hero-bg-slider');
    const heroSection = document.getElementById('hero');
    if (!slider || !heroSection) return;

    let images = [];
    let currentIndex = 0;
    let autoPlayInterval = null;
    const AUTOPLAY_TIME = 6000; // 6 seconds

    // Drag / Swipe states
    let isDragging = false;
    let startX = 0;
    let currentTranslate = 0;
    let prevTranslate = 0;

    // Detect images sequentially starting from 1.png
    async function init() {
        let i = 1;
        while (true) {
            const url = `Assets/bg_trucks/${i}.png`;
            try {
                // Use fetch with HEAD to see if the image exists
                const res = await fetch(url, { method: 'HEAD' });
                if (res.ok) {
                    images.push(url);
                    i++;
                } else {
                    break;
                }
            } catch (err) {
                // Fallback to GET check
                try {
                    const res2 = await fetch(url);
                    if (res2.ok) {
                        images.push(url);
                        i++;
                    } else {
                        break;
                    }
                } catch (e) {
                    break;
                }
            }
        }

        // Fallback to 1-5 if none detected or search fails
        if (images.length === 0) {
            for (let j = 1; j <= 5; j++) {
                images.push(`Assets/bg_trucks/${j}.png`);
            }
        }

        renderSlides();
        setupEvents();
        startAutoPlay();
    }

    function renderSlides() {
        slider.innerHTML = '';
        images.forEach((src, idx) => {
            const slide = document.createElement('div');
            slide.className = 'hero-bg-slide';
            
            const img = document.createElement('img');
            img.src = src;
            img.alt = `NMC Truck Background ${idx + 1}`;
            if (idx > 0) img.loading = 'lazy';
            
            slide.appendChild(img);
            slider.appendChild(slide);
        });
        updateSliderPosition();
    }

    function updateSliderPosition() {
        currentTranslate = -currentIndex * window.innerWidth;
        prevTranslate = currentTranslate;
        slider.style.transform = `translate3d(${currentTranslate}px, 0px, 0px)`;
    }

    function startAutoPlay() {
        stopAutoPlay();
        autoPlayInterval = setInterval(() => {
            if (images.length <= 1) return;
            currentIndex = (currentIndex + 1) % images.length;
            slider.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            updateSliderPosition();
        }, AUTOPLAY_TIME);
    }

    function stopAutoPlay() {
        if (autoPlayInterval) {
            clearInterval(autoPlayInterval);
        }
    }

    // Touch & Mouse Drag Handlers
    function setupEvents() {
        heroSection.addEventListener('dragstart', (e) => e.preventDefault());

        // Mouse Events
        heroSection.addEventListener('mousedown', dragStart);
        heroSection.addEventListener('mousemove', dragMove);
        window.addEventListener('mouseup', dragEnd);

        // Touch Events
        heroSection.addEventListener('touchstart', dragStart, { passive: true });
        heroSection.addEventListener('touchmove', dragMove, { passive: false });
        heroSection.addEventListener('touchend', dragEnd);

        // Handle window resize
        window.addEventListener('resize', () => {
            slider.style.transition = 'none';
            updateSliderPosition();
        });
    }

    function getPositionX(event) {
        return event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
    }

    function dragStart(event) {
        // Don't trigger dragging if clicking a button, link, input, or other interactive controls
        const target = event.target;
        if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('textarea')) {
            return;
        }

        isDragging = true;
        startX = getPositionX(event);
        stopAutoPlay();

        slider.style.transition = 'none';
        
        // Prevent text selection inside hero while dragging
        heroSection.style.userSelect = 'none';
        document.body.style.userSelect = 'none';
    }

    function dragMove(event) {
        if (!isDragging) return;

        const currentX = getPositionX(event);
        const currentPosition = currentX - startX;
        
        // Translate the slider in real-time
        const translate = prevTranslate + currentPosition;
        slider.style.transform = `translate3d(${translate}px, 0px, 0px)`;
        
        // Prevent scrolling page vertically when swiping horizontally
        if (event.type === 'touchmove') {
            if (Math.abs(currentPosition) > 10) {
                event.preventDefault();
            }
        }
    }

    function dragEnd(event) {
        if (!isDragging) return;
        isDragging = false;
        
        heroSection.style.userSelect = '';
        document.body.style.userSelect = '';

        const currentX = event.type.includes('mouse') ? event.pageX : (event.changedTouches ? event.changedTouches[0].clientX : startX);
        const movedBy = currentX - startX;

        const threshold = window.innerWidth * 0.15; // 15% of viewport width

        slider.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';

        if (movedBy < -threshold && currentIndex < images.length - 1) {
            currentIndex += 1;
        } else if (movedBy > threshold && currentIndex > 0) {
            currentIndex -= 1;
        }

        updateSliderPosition();
        startAutoPlay();
    }

    init();
});
