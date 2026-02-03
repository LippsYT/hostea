// Load properties on home page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('propertiesGrid')) {
        displayProperties(properties);
    }
});

function displayProperties(propertiesToShow) {
    const grid = document.getElementById('propertiesGrid');
    grid.innerHTML = '';
    
    propertiesToShow.forEach(property => {
        const card = createPropertyCard(property);
        grid.appendChild(card);
    });
}

function createPropertyCard(property) {
    const card = document.createElement('div');
    card.className = 'property-card';
    card.onclick = () => window.location.href = `/property.html?id=${property.id}`;
    
    card.innerHTML = `
        <div class="property-image">
            ${property.type === 'HOTEL' ? '🏨' : '🏠'} ${property.name}
        </div>
        <div class="property-content">
            <h3 class="property-name">${property.name}</h3>
            ${property.type === 'HOTEL' ? `<p class="property-address">${property.rooms} habitaciones</p>` : ''}
            <p class="property-address">${property.address}</p>
            <p class="property-zone">📍 ${property.zone}</p>
            <div class="property-footer">
                <div>
                    <span class="property-price">USD ${property.pricePerNight}</span>
                    <span class="price-label">/ noche</span>
                </div>
                <a href="/property.html?id=${property.id}" class="btn-secondary" onclick="event.stopPropagation()">
                    Ver Detalles
                </a>
            </div>
        </div>
    `;
    
    return card;
}

function filterProperties() {
    const zone = document.getElementById('zoneFilter').value;
    const checkIn = document.getElementById('checkInDate').value;
    const checkOut = document.getElementById('checkOutDate').value;
    
    let filtered = properties;
    
    if (zone) {
        filtered = filtered.filter(p => p.zone === zone);
    }
    
    // In a real app, you would filter by availability based on dates
    // For now, we just show all matching zone properties
    
    displayProperties(filtered);
    
    // Scroll to properties section
    document.getElementById('properties').scrollIntoView({ behavior: 'smooth' });
}