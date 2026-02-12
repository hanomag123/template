function iconsLoading() {
    // Create link element for Material Symbols font
    const linkElement = document.createElement('link');
    linkElement.rel = 'stylesheet';
    linkElement.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
    
    linkElement.onload = function() {
        // Add style element with Material Symbols styles
        const styleElement = document.createElement('style');
        styleElement.textContent = ".material-symbols-outlined {font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24} .fw-100 {font-variation-settings:'wght' 100} .fw-200 {font-variation-settings:'wght' 200} .fw-300 {font-variation-settings:'wght' 300} .fw-400 {font-variation-settings:'wght' 400} .fw-500 {font-variation-settings:'wght' 500} .filled-icon {font-variation-settings:'FILL' 1}";
        
        document.head.prepend(styleElement);
        
        // Process all elements with data-icon attribute
        const iconElements = document.querySelectorAll('*[data-icon]');
        iconElements.forEach(function(element) {
            const fontSize = window.getComputedStyle(element).width;
            element.textContent = element.dataset.icon;
            element.style.fontSize = fontSize;
        });
    };
    
    document.head.prepend(linkElement);
}

function mso() {
    let fontSize, fw;
    const iconElements = document.querySelectorAll('*[data-icon]');
    
    iconElements.forEach(function(element) {
        // Check if data-fontsize attribute already exists
        if (!element.hasAttribute('data-fontsize')) {
            // Get font weight
            if (element.dataset.fw !== undefined) {
                fw = element.dataset.fw;
            } else {
                fw = 500;
            }
            
            fontSize = window.getComputedStyle(element).fontSize;
            element.setAttribute('data-fontsize', fontSize);
            console.log(element.dataset.icon + " = " + fontSize);
            
            // Apply styles
            element.style.fontSize = '0';
            element.style.width = fontSize;
            element.style.minWidth = fontSize;
            element.style.height = fontSize;
            element.style.minHeight = fontSize;
            element.style.display = 'block';
            
            // Add classes
            element.classList.add('material-symbols-outlined');
            element.classList.add('fw-' + fw);
        }
    });
    
    iconsLoading();
}

// Document ready equivalent
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        mso();
    });
} else {
    // DOM is already loaded
    mso();
}