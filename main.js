import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- DOM Elements ---
const startScreen = document.getElementById('startScreen');
const colorSelector = document.getElementById('colorSelector');
const startButton = document.getElementById('startButton');
const gameCanvas = document.getElementById('gameCanvas');
const levelDisplay = document.getElementById('levelDisplay');
const livesDisplay = document.getElementById('livesDisplay'); // Added reference
const winMessage = document.getElementById('winMessage');
const uiContainer = document.getElementById('uiContainer'); // Added reference

// --- Basic Scene Setup ---
const scene = new THREE.Scene();
// Add Fog
scene.fog = new THREE.FogExp2(0x000000, 0.015); // Black fog, density 0.015
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// Enable Shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

// --- Post-processing (Bloom) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2, // strength
    0.4, // radius
    0.85 // threshold
);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- Starfield Particle System ---
const starGeometry = new THREE.BufferGeometry();
const starVertices = [];
for (let i = 0; i < 10000; i++) {
    const x = THREE.MathUtils.randFloatSpread(2000);
    const y = THREE.MathUtils.randFloatSpread(2000);
    const z = THREE.MathUtils.randFloatSpread(2000);
    // Ensure stars are reasonably far away
    if (x*x + y*y + z*z > 100 * 100) { // Avoid stars too close to center
         starVertices.push(x, y, z);
    }
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: true });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// --- Audio Setup ---
const listener = new THREE.AudioListener();
camera.add(listener); // Attach listener to camera
const audioLoader = new THREE.AudioLoader();

const music = new THREE.Audio(listener);
const jumpSound = new THREE.Audio(listener);
const goalSound = new THREE.Audio(listener);
const fallSound = new THREE.Audio(listener);
const heartCollectSound = new THREE.Audio(listener); // Added Heart Sound

// Load sounds (replace placeholders with your actual files)
audioLoader.load('sounds/music.mp3', function(buffer) {
    music.setBuffer(buffer);
    music.setLoop(true);
    music.setVolume(0.3);
    // Don't play yet, wait for start button
});
audioLoader.load('sounds/jump.wav', function(buffer) {
    jumpSound.setBuffer(buffer);
    jumpSound.setLoop(false);
    jumpSound.setVolume(0.6);
});
audioLoader.load('sounds/goal.wav', function(buffer) {
    goalSound.setBuffer(buffer);
    goalSound.setLoop(false);
    goalSound.setVolume(0.7);
});
audioLoader.load('sounds/fall.wav', function(buffer) {
    fallSound.setBuffer(buffer);
    fallSound.setLoop(false);
    fallSound.setVolume(0.5);
});
audioLoader.load('sounds/heart.wav', function(buffer) { // Load Heart Sound
    heartCollectSound.setBuffer(buffer);
    heartCollectSound.setLoop(false);
    heartCollectSound.setVolume(0.8);
});


// --- Visual Enhancements ---
// Skybox (Updated for Space Theme)
const cubeTextureLoader = new THREE.CubeTextureLoader();
cubeTextureLoader.setPath('textures/skybox/'); // Path remains the same, file names change
const skyboxTexture = cubeTextureLoader.load([
    'space_px.jpg', 'space_nx.jpg', // Right (+X), Left (-X)
    'space_py.jpg', 'space_ny.jpg', // Top (+Y), Bottom (-Y)
    'space_pz.jpg', 'space_nz.jpg'  // Front (+Z), Back (-Z)
]);
scene.background = skyboxTexture;

// Lighting adjustments
const ambientLight = new THREE.AmbientLight(0x404060, 0.6); // Cooler ambient for space
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(10, 20, 15); // Adjusted position
// Enable Light Shadows
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024; // Shadow map resolution
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
// Optional: Adjust shadow camera bounds if needed for specific levels
// directionalLight.shadow.camera.left = -20;
// directionalLight.shadow.camera.right = 20;
// directionalLight.shadow.camera.top = 20;
// directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// --- Player Sphere ---
let playerColor = 0x0077ff; // Default color, will be set by selector
const sphereRadius = 0.5;
const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 32, 32);
// Material will be created after color selection
let sphereMaterial = new THREE.MeshStandardMaterial({ color: playerColor, roughness: 0.4, metalness: 0.6 }); // Slightly shinier
const playerSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
// Enable Player Shadows
playerSphere.castShadow = true;
// Initial position is set by loadLevel
scene.add(playerSphere);

// --- Materials (reusable) ---
const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x8888AA, roughness: 0.9, metalness: 0.1 }); // Slightly different platform color/texture
const goalMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ffdd,
    emissive: 0x00ffff, // Brighter base emissive for bloom
    emissiveIntensity: 1.0, // Intensity controlled dynamically + bloom
    roughness: 0.2,
    toneMapped: false // Important for bloom effect
});
const goalGeometry = new THREE.SphereGeometry(0.8, 16, 16);

// Collectible Heart Material/Geometry
const heartGeometry = new THREE.SphereGeometry(0.3, 12, 12); // Smaller sphere for hearts
const heartMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xcc0000, // Brighter base emissive for bloom
    emissiveIntensity: 1.0,
    roughness: 0.5,
    metalness: 0.3,
    toneMapped: false // Important for bloom effect
});

// --- Level Data (Expanded to 20 Levels with Hearts) ---
const levels = [
    // Levels 1-10 (add optional 'hearts' arrays)
    { platforms: [{ size: [5, 0.5, 5], position: [0, 0, 0] }, { size: [4, 0.5, 4], position: [0, -0.5, -8] }, { size: [3, 0.5, 3], position: [6, -1, -12] }, { size: [5, 0.5, 2], position: [6, -1, -18] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(6, 0.3, -18) },
    { platforms: [{ size: [4, 0.5, 4], position: [0, 0, 0] }, { size: [2, 0.5, 2], position: [0, -0.5, -7] }, { size: [2, 0.5, 2], position: [-5, -1, -11] }, { size: [2, 0.5, 2], position: [0, -1.5, -15] }, { size: [4, 0.5, 4], position: [0, -1.5, -22] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(0, 0.3, -22), hearts: [new THREE.Vector3(-5, 0, -11)] }, // Heart on 3rd platform
    { platforms: [{ size: [3, 0.5, 3], position: [0, 0, 0] }, { size: [1, 0.5, 5], position: [5, 0, 0] }, { size: [3, 0.5, 3], position: [10, 0, 0] }, { size: [1.5, 0.5, 1.5], position: [10, 0.5, -5] }, { size: [1.5, 0.5, 1.5], position: [6, 1, -8] }, { size: [3, 0.5, 3], position: [6, 1, -13] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(6, 2.3, -13) },
    { platforms: [{ size: [4, 0.5, 4], position: [0, 0, 0] }, { size: [3, 0.5, 3], position: [0, 0, -9] }, { size: [3, 0.5, 3], position: [8, 0.5, -15] }, { size: [3, 0.5, 3], position: [8, 0.5, -24] } ], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(8, 1.8, -24), hearts: [new THREE.Vector3(8, 1.5, -15)] },
    { platforms: [{ size: [3, 0.5, 3], position: [0, 0, 0] }, { size: [2, 0.5, 2], position: [-5, -0.5, -5] }, { size: [2, 0.5, 2], position: [0, -1.0, -10] }, { size: [2, 0.5, 2], position: [5, -1.5, -15] }, { size: [3, 0.5, 3], position: [5, -1.5, -22] } ], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(5, -0.2, -22) },
    { platforms: [{ size: [2, 0.5, 2], position: [0, 0, 0] }, { size: [8, 0.5, 1], position: [0, 0, -6] }, { size: [1, 0.5, 6], position: [-4.5, 0, -12.5] }, { size: [2, 0.5, 2], position: [-4.5, 0.5, -16] } ], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(-4.5, 1.8, -16), hearts: [new THREE.Vector3(-4.5, 1, -12.5)] },
    { platforms: [{ size: [4, 0.5, 4], position: [0, 0, 0] }, { size: [2, 0.5, 2], position: [0, 1, -7] }, { size: [2, 0.5, 2], position: [6, 0, -11] }, { size: [2, 0.5, 2], position: [6, 2, -16] }, { size: [3, 0.5, 3], position: [0, 1.5, -20] } ], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(0, 2.8, -20) },
    { platforms: [{ size: [4, 0.5, 4], position: [0, 0, 0] }, { size: [6, 0.5, 2], position: [0, 0, -6] }, { size: [2, 0.5, 4], position: [-4, 0, -6] }, { size: [2, 0.5, 4], position: [4, 0, -6] }, { size: [3, 0.5, 3], position: [4, 0.5, -12] } /* Correct path */ , { size: [2, 0.5, 2], position: [-4, 0.5, -10] } /* Dead end */ ], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(4, 1.8, -12), hearts: [new THREE.Vector3(-4, 1.5, -10)] }, // Heart on dead end
    { platforms: [{ size: [2, 0.5, 2], position: [0, 0, 0] }, { size: [1, 0.5, 1], position: [0, 0.2, -4] }, { size: [1, 0.5, 1], position: [3, 0.4, -6] }, { size: [1, 0.5, 1], position: [0, 0.6, -8] }, { size: [1, 0.5, 1], position: [-3, 0.8, -10] }, { size: [2, 0.5, 2], position: [-3, 1.0, -14] } ], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(-3, 2.3, -14) },
    { platforms: [{ size: [3, 0.5, 3], position: [0, 0, 0] }, { size: [1, 0.5, 6], position: [0, -1, -6] }, { size: [6, 0.5, 1], position: [6, -1, -9.5] }, { size: [1.5, 0.5, 1.5], position: [10, -0.5, -9.5] }, { size: [1.5, 0.5, 1.5], position: [13, 0, -6] }, { size: [1.5, 0.5, 1.5], position: [13, 1, -12] }, { size: [3, 0.5, 3], position: [8, 1.5, -16] } ], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(8, 2.8, -16), hearts: [new THREE.Vector3(13, 1, -9.5)] }, // Near a tricky jump
    // Level 11: Introducing moving platforms (concept - actual movement not implemented here)
    { platforms: [{ size: [4, 0.5, 4], position: [0, 0, 0] }, { size: [3, 0.5, 3], position: [0, 0, -8] /* Moving */ }, { size: [3, 0.5, 3], position: [0, 0, -16] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(0, 1.3, -16) },
    // Level 12: More complex path, multiple heights
    { platforms: [{ size: [4, 0.5, 4], position: [0, 0, 0] }, { size: [2, 0.5, 2], position: [5, -1, -5] }, { size: [2, 0.5, 2], position: [5, 0, -10] }, { size: [1, 0.5, 4], position: [0, 0, -10] }, { size: [2, 0.5, 2], position: [-5, 1, -15] }, { size: [4, 0.5, 4], position: [-5, 1, -22] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(-5, 2.3, -22), hearts: [new THREE.Vector3(0, 1, -10)] },
    // Level 13: Very narrow winding path
    { platforms: [{ size: [2, 0.5, 2], position: [0, 0, 0] }, { size: [1, 0.5, 6], position: [0, 0, -5] }, { size: [6, 0.5, 1], position: [3.5, 0, -8.5] }, { size: [1, 0.5, 6], position: [7, 0, -12] }, { size: [2, 0.5, 2], position: [7, 0, -17] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(7, 1.3, -17) },
    // Level 14: Jumps with alternating heights
    { platforms: [{ size: [3, 0.5, 3], position: [0, 0, 0] }, { size: [2, 0.5, 2], position: [0, 1, -6] }, { size: [2, 0.5, 2], position: [5, 0, -10] }, { size: [2, 0.5, 2], position: [5, 2, -15] }, { size: [2, 0.5, 2], position: [0, 1, -20] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(0, 2.3, -20), hearts: [new THREE.Vector3(5, 1, -10), new THREE.Vector3(5, 3, -15)] },
    // Level 15: Large gaps requiring speed/momentum
    { platforms: [{ size: [5, 0.5, 5], position: [0, 0, 0] }, { size: [3, 0.5, 3], position: [0, 0, -12] }, { size: [3, 0.5, 3], position: [0, 0, -24] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(0, 1.3, -24) },
    // Level 16: More maze elements
    { platforms: [{ size: [5, 0.5, 5], position: [0, 0, 0] }, { size: [1, 0.5, 8], position: [0, 0, -7] }, { size: [8, 0.5, 1], position: [4.5, 0, -11.5] }, { size: [8, 0.5, 1], position: [-4.5, 0, -11.5] }, { size: [3, 0.5, 3], position: [4.5, 0.5, -16] }, { size: [3, 0.5, 3], position: [-4.5, 0, -16] } /* Decoy */], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(4.5, 1.8, -16), hearts: [new THREE.Vector3(-4.5, 1, -16)] },
    // Level 17: Disappearing platforms (concept - not implemented)
    { platforms: [{ size: [4, 0.5, 4], position: [0, 0, 0] }, { size: [2, 0.5, 2], position: [0, 0, -6] /* Disappears */ }, { size: [2, 0.5, 2], position: [0, 0, -12] }, { size: [2, 0.5, 2], position: [0, 0, -18] /* Disappears */ }, { size: [4, 0.5, 4], position: [0, 0, -24] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(0, 1.3, -24) },
    // Level 18: High climb with small platforms
    { platforms: [{ size: [3, 0.5, 3], position: [0, 0, 0] }, { size: [1, 0.5, 1], position: [4, 1, -3] }, { size: [1, 0.5, 1], position: [0, 2, -6] }, { size: [1, 0.5, 1], position: [-4, 3, -9] }, { size: [1, 0.5, 1], position: [0, 4, -12] }, { size: [3, 0.5, 3], position: [0, 4.5, -16] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(0, 5.8, -16), hearts: [new THREE.Vector3(-4, 4, -9)] },
    // Level 19: Long narrow path with side jumps for hearts
    { platforms: [{ size: [2, 0.5, 2], position: [0, 0, 0] }, { size: [1, 0.5, 20], position: [0, 0, -12] }, { size: [2, 0.5, 2], position: [4, 0, -8] }, { size: [2, 0.5, 2], position: [-4, 0, -16] }, { size: [2, 0.5, 2], position: [0, 0, -24] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(0, 1.3, -24), hearts: [new THREE.Vector3(4, 1, -8), new THREE.Vector3(-4, 1, -16)] },
    // Level 20: Final Challenge - Mix of elements
    { platforms: [{ size: [4, 0.5, 4], position: [0, 0, 0] }, { size: [1, 0.5, 6], position: [0, -1, -6] }, { size: [1, 0.5, 1], position: [5, -0.5, -9] }, { size: [1, 0.5, 1], position: [0, 0, -12] }, { size: [1, 0.5, 1], position: [-5, 0.5, -15] }, { size: [6, 0.5, 1], position: [-5, 1, -19] }, { size: [3, 0.5, 3], position: [-10, 1.5, -19] }], startPosition: new THREE.Vector3(0, 1, 0), goalPosition: new THREE.Vector3(-10, 2.8, -19), hearts: [new THREE.Vector3(0, 1, -12), new THREE.Vector3(-5, 2, -19)] },
];


// --- Game State ---
let currentLevelIndex = 0;
const MAX_LIVES = 3; // Initial max lives, can be exceeded by collecting hearts
let playerLives = MAX_LIVES;
let activePlatforms = [];
let activeHearts = []; // Added array for active hearts
let currentGoal = null;
let currentStartPosition = new THREE.Vector3(); // Holds start pos for current level
let gameWon = false; // Flag to check if the game is won
let gameRunning = false; // Flag to check if game loop should process logic
let isFalling = false; // Flag to prevent repeated fall sounds

// --- Camera Setup ---
camera.position.set(0, 5, 8); // Initial position before game starts
// camera.lookAt(playerSphere.position); // Look at 0,0,0 initially


// --- Physics Variables ---
const gravity = new THREE.Vector3(0, -9.81, 0);
const playerVelocity = new THREE.Vector3(0, 0, 0);
const moveForce = 35.0;
const maxSpeed = 14.0;
const damping = 0.95;
const jumpForce = 7.0;
let onGround = false;
const fallThreshold = -25; // Even lower threshold for more vertical levels


// --- Input Handling ---
const keysPressed = {};
document.addEventListener('keydown', (event) => {
    // Prevent space bar from scrolling page when game is running
    if (gameRunning && event.code === 'Space') {
        event.preventDefault();
    }
    keysPressed[event.code] = true;
});
document.addEventListener('keyup', (event) => {
    keysPressed[event.code] = false;
});

// --- Start Screen Logic ---
colorSelector.addEventListener('click', (event) => {
    if (event.target.classList.contains('color-btn')) {
        playerColor = parseInt(event.target.getAttribute('data-color')); // Use parseInt for hex

        // Update visual selection
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('selected'));
        event.target.classList.add('selected');

        console.log("Selected color:", playerColor.toString(16)); // Log hex color
    }
});

startButton.addEventListener('click', () => {
    // Reset game state on start
    playerLives = MAX_LIVES; // Reset to initial max lives
    currentLevelIndex = 0;
    gameWon = false;
    isFalling = false;
    updateLivesDisplay();

    // Apply selected color to sphere material BEFORE starting
    sphereMaterial.color.setHex(playerColor);

    startScreen.classList.add('hidden');
    gameCanvas.classList.remove('hidden');
    uiContainer.classList.remove('hidden');
    winMessage.classList.add('hidden'); // Ensure win message is hidden at start

    if (music.buffer && !music.isPlaying) {
        music.play();
    }
    gameRunning = true;
    loadLevel(currentLevelIndex);
    animate();
});

// --- UI Update Function ---
function updateLivesDisplay() {
    // No upper limit imposed here, just display current count
    livesDisplay.textContent = `Lives: ${'❤️'.repeat(playerLives)}`;
}


// --- Level Management ---

function clearLevel() {
    activePlatforms.forEach(platform => {
        scene.remove(platform);
        platform.geometry.dispose();
    });
    activePlatforms = [];

    // Clear Hearts
    activeHearts.forEach(heart => {
        scene.remove(heart);
        // Don't dispose shared geometry/material for hearts
    });
    activeHearts = [];

    if (currentGoal) {
        scene.remove(currentGoal);
        // Don't dispose shared goal geometry/material
        currentGoal = null;
    }
}

function loadLevel(levelIndex) {
    clearLevel();

    if (levelIndex >= levels.length) {
        gameWon = true;
        gameRunning = false;
        winMessage.classList.remove('hidden');
        if (music.isPlaying) {
            music.stop();
        }
        console.log("You Win!");
        return;
    }

    // If not won, ensure win message is hidden and game state is correct
    gameWon = false;
    winMessage.classList.add('hidden');
    // gameRunning should already be true unless coming from win state

    const levelData = levels[levelIndex];
    currentStartPosition.copy(levelData.startPosition);

    // Create platforms
    levelData.platforms.forEach(pData => {
        const geometry = new THREE.BoxGeometry(pData.size[0], pData.size[1], pData.size[2]);
        const platform = new THREE.Mesh(geometry, platformMaterial);
        platform.position.set(pData.position[0], pData.position[1], pData.position[2]);
        // Enable Platform Shadows
        platform.receiveShadow = true;
        scene.add(platform);
        activePlatforms.push(platform);
    });

    // Create hearts (if defined for the level)
    if (levelData.hearts) {
        levelData.hearts.forEach(hPos => {
            const heart = new THREE.Mesh(heartGeometry, heartMaterial.clone()); // Clone material for unique animation offsets
            heart.position.set(hPos.x, hPos.y + 0.5, hPos.z);
            heart.castShadow = true;
            // Add custom data for animation
            heart.userData.initialY = heart.position.y;
            heart.userData.bobOffset = Math.random() * Math.PI * 2; // Random start phase
            scene.add(heart);
            activeHearts.push(heart);
        });
    }

    // Create goal
    currentGoal = new THREE.Mesh(goalGeometry, goalMaterial);
    currentGoal.position.copy(levelData.goalPosition);
    scene.add(currentGoal);

    resetPlayer();
    levelDisplay.textContent = `Level: ${levelIndex + 1}`;
    updateLivesDisplay();

    // Adjust camera
    camera.position.set(currentStartPosition.x, currentStartPosition.y + 5, currentStartPosition.z + 8);
    camera.lookAt(currentStartPosition);
    // If using OrbitControls:
    // controls.target.copy(currentStartPosition);
    // controls.update();
}

// --- Reset Function ---
function handleFall() {
    if (isFalling) return;
    isFalling = true;
    playerLives--;
    updateLivesDisplay();

    if (fallSound.buffer && !fallSound.isPlaying) {
        fallSound.stop();
        fallSound.play();
    }

    if (playerLives <= 0) {
        // Game Over - Reset to start screen or show game over message
        console.log("Game Over!");
        gameRunning = false;
        if (music.isPlaying) music.stop();
        // For simplicity, just go back to start screen
        setTimeout(() => {
            uiContainer.classList.add('hidden');
            gameCanvas.classList.add('hidden');
            startScreen.classList.remove('hidden');
            // Reset level index for next game start
            currentLevelIndex = 0;
        }, 1500); // Delay to let sound play and see loss
    } else {
        // Still have lives, just reset player position after delay
        setTimeout(() => {
            resetPlayer();
        }, 300); // Delay for sound
    }
}

function resetPlayer() {
    // Resets only position and physics state, not lives or level
    if (fallSound.isPlaying) {
        fallSound.stop();
    }
    if (!currentStartPosition) return;
    playerSphere.position.copy(currentStartPosition);
    playerVelocity.set(0, 0, 0);
    onGround = false;
    isFalling = false; // Reset falling flag *after* potentially playing sound/checking lives
}


// --- Game Loop ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime(); // Get total time for animations

    // Animate Stars (optional subtle rotation)
    // stars.rotation.y += 0.0001;

    if (!gameRunning && !gameWon) {
         // Render using composer even when paused/game over
         composer.render();
        return;
    }
    if (gameWon) {
        // Render using composer on win screen
        composer.render();
        return;
    }

    // --- Check for Falling ---
    // Moved up to prevent goal check after falling
    if (playerSphere.position.y < fallThreshold && !isFalling) {
        handleFall(); // Use the new handler function
        composer.render(); // Render one last time before potential pause
        return; // Stop processing this frame if falling
    }

    // If falling is in progress (waiting for timeout), don't process further
    if (isFalling) {
        composer.render();
        return;
    }

    // --- Handle Input & Calculate Movement Force ---
    const forceDirection = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    // Ensure directions are projected onto XZ plane if camera pitches
    const forwardDirection = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
    // Calculate the actual RIGHT vector relative to the planar forward direction
    const rightDirection = new THREE.Vector3().crossVectors(forwardDirection, camera.up).normalize();


    if (keysPressed['ArrowUp'] || keysPressed['KeyW']) {
        forceDirection.add(forwardDirection);
    }
    if (keysPressed['ArrowDown'] || keysPressed['KeyS']) {
        forceDirection.sub(forwardDirection);
    }
    if (keysPressed['ArrowLeft'] || keysPressed['KeyA']) {
        forceDirection.sub(rightDirection); // Subtract the TRUE right vector for left movement
    }
    if (keysPressed['ArrowRight'] || keysPressed['KeyD']) {
        forceDirection.add(rightDirection); // Add the TRUE right vector for right movement
    }

    // Jump
    if ((keysPressed['Space']) && onGround) {
         playerVelocity.y = jumpForce;
         onGround = false;
         if (jumpSound.buffer && !jumpSound.isPlaying) {
             jumpSound.stop(); // Ensure it restarts if somehow stuck
             jumpSound.play();
         }
    }


    // Normalize force direction
    if (forceDirection.lengthSq() > 0) {
        forceDirection.normalize();
    }

    // Apply force
    const force = forceDirection.multiplyScalar(moveForce * deltaTime);
    playerVelocity.add(force);


    // --- Apply Physics ---
    if (!onGround) {
        playerVelocity.addScaledVector(gravity, deltaTime);
    }

    // Apply damping
    playerVelocity.x *= damping;
    playerVelocity.z *= damping;

    // Clamp speed
    const horizontalVelocity = new THREE.Vector2(playerVelocity.x, playerVelocity.z);
    if (horizontalVelocity.length() > maxSpeed) {
        horizontalVelocity.normalize().multiplyScalar(maxSpeed);
        playerVelocity.x = horizontalVelocity.x;
        playerVelocity.z = horizontalVelocity.y;
    }

    // Update position
    const potentialPosition = playerSphere.position.clone().addScaledVector(playerVelocity, deltaTime);


    // --- Collision Detection ---
    onGround = false;
    const playerBox = new THREE.Box3().setFromObject(playerSphere);
    playerBox.min.y += 0.1;
    playerBox.max.y -= 0.1;

    activePlatforms.forEach(platform => {
        const platformBox = new THREE.Box3().setFromObject(platform);
        const platformTop = platform.position.y + platform.geometry.parameters.height / 2;
        const playerBottom = potentialPosition.y - sphereRadius;

        const overlapsHorizontallyNow = playerSphere.position.x + sphereRadius > platformBox.min.x &&
                                      playerSphere.position.x - sphereRadius < platformBox.max.x &&
                                      playerSphere.position.z + sphereRadius > platformBox.min.z &&
                                      playerSphere.position.z - sphereRadius < platformBox.max.z;

        // Vertical Collision (Landing)
        if (playerVelocity.y <= 0 &&
            playerBottom <= platformTop &&
            playerSphere.position.y - sphereRadius >= platformTop - 0.1 &&
            overlapsHorizontallyNow)
         {
            playerVelocity.y = 0;
            potentialPosition.y = platformTop + sphereRadius;
            onGround = true;
            isFalling = false; // Landed, so not falling
        }

        // Horizontal Collision
        const potentialPlayerBox = new THREE.Box3().setFromCenterAndSize(
            potentialPosition,
            new THREE.Vector3(sphereRadius * 1.8, sphereRadius * 1.8, sphereRadius * 1.8) // Slightly smaller box for collision
        );

        if (potentialPlayerBox.intersectsBox(platformBox) && !onGround) {
            const collisionCheckPos = playerSphere.position; // Check based on current position before move
            const platformHeight = platform.geometry.parameters.height;
            const playerFeet = collisionCheckPos.y - sphereRadius;
            const playerHead = collisionCheckPos.y + sphereRadius;
            const platformBottom = platform.position.y - platformHeight / 2;

            // Only collide horizontally if vertically aligned (avoids bumping head/feet weirdly)
            if (playerHead > platformBottom && playerFeet < platformTop) {
                // Simplified push-out - Determine which axis has *least* overlap if we moved
                const dx = potentialPosition.x - platform.position.x;
                const dz = potentialPosition.z - platform.position.z;
                const combinedHalfWidth = sphereRadius + platform.geometry.parameters.width / 2;
                const combinedHalfDepth = sphereRadius + platform.geometry.parameters.depth / 2;

                const overlapX = combinedHalfWidth - Math.abs(dx);
                const overlapZ = combinedHalfDepth - Math.abs(dz);

                 if (overlapX > 0 && overlapZ > 0) { // Make sure there's overlap on both axes potentiallly
                    if (overlapX < overlapZ) { // Less overlap on X axis, push horizontally
                       if(playerVelocity.x !== 0){
                            potentialPosition.x = playerSphere.position.x;
                            playerVelocity.x *= -0.1; // Dampen velocity on collision
                       }
                    } else { // Less overlap on Z axis, push vertically
                         if(playerVelocity.z !== 0){
                            potentialPosition.z = playerSphere.position.z;
                            playerVelocity.z *= -0.1; // Dampen velocity on collision
                         }
                    }
                 }
            }
        }
    });

    // --- Heart Collection Collision Detection ---
    const playerRadiusSq = sphereRadius * sphereRadius;
    for (let i = activeHearts.length - 1; i >= 0; i--) {
        const heart = activeHearts[i];
        const distSq = playerSphere.position.distanceToSquared(heart.position);
        const heartRadius = heart.geometry.parameters.radius;
        const collisionDistSq = (sphereRadius + heartRadius) * (sphereRadius + heartRadius);

        if (distSq < collisionDistSq) {
            // Collision detected!
            playerLives++;
            updateLivesDisplay();
            if (heartCollectSound.buffer && !heartCollectSound.isPlaying) {
                heartCollectSound.stop(); // Ensure it plays fresh
                heartCollectSound.play();
            }

            // Remove heart from scene and array
            scene.remove(heart);
            activeHearts.splice(i, 1);
            // No need to dispose geometry/material as they are shared
        }
    }

    // Apply final position
    playerSphere.position.copy(potentialPosition);


    // --- Check for Goal ---
     if (currentGoal) { // Removed !isFalling check here as it's handled above
        const distanceToGoal = playerSphere.position.distanceTo(currentGoal.position);
        const goalRadius = currentGoal.geometry.parameters.radius;
        if (distanceToGoal < sphereRadius + goalRadius) {
            console.log(`Level ${currentLevelIndex + 1} Complete!`);
            if (goalSound.buffer && !goalSound.isPlaying) {
                goalSound.stop();
                goalSound.play();
            }
            currentLevelIndex++;
            // Delay level load slightly
            // Temporarily disable game logic during transition
            gameRunning = false;
            setTimeout(() => {
                loadLevel(currentLevelIndex);
                if (!gameWon) { // Only set gameRunning back if not won
                   gameRunning = true;
                }
            }, 300); // Delay to let sound play / visual feedback
             // Stop further updates this frame
            composer.render();
            return;
        }
     }

    // --- Animate Hearts ---
    activeHearts.forEach(heart => {
        // Bobbing
        const bobSpeed = 2;
        const bobAmount = 0.15;
        heart.position.y = heart.userData.initialY + Math.sin(elapsedTime * bobSpeed + heart.userData.bobOffset) * bobAmount;
        // Rotation
        heart.rotation.y += 0.02; // Adjust speed as needed
    });

    // --- Update Camera ---
    // Smooth follow camera
    const targetCameraPosition = playerSphere.position.clone().add(new THREE.Vector3(0, 5, 8));
    camera.position.lerp(targetCameraPosition, 0.05);
    camera.lookAt(playerSphere.position);

    // --- Render Scene --- // !! Use Composer instead of Renderer !!
    composer.render();
}

// --- Handle Window Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Update composer and bloom pass on resize
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.setSize(window.innerWidth, window.innerHeight);
});

// --- Game Initialization ---
// Don't start game loop or load level here anymore.
// It's triggered by the startButton click.
// Initial render of the empty scene with skybox? Optional.
// renderer.render(scene, camera);

// Add initial selection state for the default color button
document.querySelector(`.color-btn[data-color='0x0077ff']`).classList.add('selected');
updateLivesDisplay(); // Initial display update before game starts
