// TANJUNG PANAS — shared tuning and world data.
// All numbers live here so the whole game can be retuned from one place.

export const CFG = {
  // World: a 720 x 720 unit city, roads on a 60-unit grid.
  worldSize: 720,
  roadStep: 60,
  roadHalf: 6, // half width of a road
  blockSize: 48,
  // Sun: low warm sunset from the west, long shadows to the east.
  sunColor: 0xffb36b,
  sunIntensity: 1.35,
  hemiSky: 0x8fb7d9,
  hemiGround: 0x8a5f43,
  hemiIntensity: 0.75,
  fogColor: 0xf2a35e,
  fogNear: 220,
  fogFar: 620,
  skyTop: 0x3d6f9e,
  skyBottom: 0xff9e57,
  // Driving
  carAccel: 26,
  carBrake: 42,
  carMaxSpeed: 34,
  carMaxReverse: 10,
  carTurn: 1.9,
  carGrip: 6.5,
  // On foot
  walkSpeed: 6,
  runSpeed: 10,
  // Wanted
  maxWanted: 5,
  wantedDecayDelay: 14, // seconds unseen before stars start falling
  wantedDecayStep: 9, // seconds per lost star
  // Police
  policeTopSpeed: 36,
  policeSpawnDist: 90,
  policeMaxActive: 5,
  // Player
  playerHealth: 100,
  // Cash
  startCash: 250,
};

// District rectangles in world coords (x: east+, z: south+).
export const DISTRICTS = {
  beach: { x0: -360, x1: -306, z0: -360, z1: 360, kind: 'beach' },
  port: { x0: 240, x1: 360, z0: -300, z1: -60, kind: 'port' },
  market: { x0: -120, x1: 120, z0: 120, z1: 300, kind: 'market' },
  modern: { x0: -300, x1: 300, z0: -360, z1: -180, kind: 'modern' },
  hills: { x0: 120, x1: 300, z0: 120, z1: 300, kind: 'hills' },
};

// Warm Indonesian port-city palette for buildings.
export const BUILDING_COLORS = {
  market: [0xe8a33d, 0xd96c3f, 0xc94f4f, 0xf2d8a7, 0x7fb3a0, 0xe07a5f],
  modern: [0x9db8c4, 0x7d9db0, 0xb8c8d0, 0x8fa8b8, 0xc4d4dc],
  hills: [0xf2e3c6, 0xe8b48a, 0xd98a6a, 0xcfd8c0, 0xf0d0a0],
  default: [0xd9a05b, 0xc98a6b, 0xb8b0a0, 0xe0c090, 0x9fb8a8, 0xd77a5a],
};

export const CAR_COLORS = [
  0xd23b2e, 0x2e6fd2, 0xe8b93b, 0x3aa655, 0xe8e8e8, 0x222226,
  0x7a4fd0, 0xe87a2e, 0x4fb8c9, 0xb8c22e, 0xd2709a, 0x8a8a92,
];

export const PED_SHIRTS = [
  0xe8e8e8, 0x3a7bd2, 0xd23b2e, 0x3aa655, 0xe8b93b, 0x7a4fd0,
  0xe87a2e, 0x4fb8c9, 0xd2709a, 0x5a5a60,
];

// Mission chain: Bu Sari's jobs for Raka. Each step is a goto, pickup,
// deliver, steal or escape objective. Positions are world coords.
export const MISSIONS = [
  {
    id: 1, title: 'Paket Bu Sari', reward: 400,
    intro: 'Bu Sari: "Raka, ambil paket di Pasar Lama, antar ke Pelabuhan. Jangan ditanya isinya."',
    steps: [
      { type: 'goto', label: 'Ambil paket di Pasar Lama', pos: [0, 210], radius: 10 },
      { type: 'goto', label: 'Antar paket ke Pelabuhan', pos: [288, -180], radius: 10, timed: 75 },
    ],
  },
  {
    id: 2, title: 'Taksi Gelap', reward: 350,
    intro: 'Penumpang menunggu di depan warteg. Antar dia ke Pantai — dia buru-buru.',
    steps: [
      { type: 'pickup', label: 'Jemput penumpang di Pasar Lama', pos: [-30, 240], radius: 9 },
      { type: 'goto', label: 'Antar penumpang ke Pantai Barat', pos: [-288, 60], radius: 10, timed: 60 },
    ],
  },
  {
    id: 3, title: 'Kabur dari Razia', reward: 600,
    intro: 'Polisi razia di jalan utama. Bu Sari: "Jangan berhenti. Sampai ke Bukit sebelum mereka menangkapmu."',
    steps: [
      { type: 'escape', label: 'Kabur ke Bukit — hindari polisi!', pos: [210, 210], radius: 14, wanted: 3 },
    ],
  },
  {
    id: 4, title: 'Barang di Kontainer', reward: 500,
    intro: 'Ada koper di kontainer biru, Pelabuhan. Turun dari mobil, ambil dengan jalan kaki, bawa kembali.',
    steps: [
      { type: 'onfoot', label: 'Ambil koper di kontainer (jalan kaki)', pos: [300, -150], radius: 8 },
      { type: 'goto', label: 'Bawa koper ke rumah Bu Sari di Bukit', pos: [180, 240], radius: 10 },
    ],
  },
  {
    id: 5, title: 'Antar Uang', reward: 800,
    intro: 'Uang harus sampai ke Modern District sebelum jam 6. Polisi sedang waspada — hati-hati.',
    steps: [
      { type: 'goto', label: 'Antar uang ke Menara Kaca', pos: [-60, -270], radius: 10, timed: 55 },
    ],
  },
  {
    id: 6, title: 'Pencurian Terakhir', reward: 1500,
    intro: 'Bu Sari: "Satu kerjaan terakhir. Curi mobil sport kuning di Pelabuhan, bawa ke Bukit. Setelah ini kita selesai."',
    steps: [
      { type: 'steal', label: 'Curi mobil sport kuning di Pelabuhan', pos: [270, -240], radius: 9 },
      { type: 'escape', label: 'Bawa mobil itu ke Bukit — polisi mengejarmu!', pos: [240, 180], radius: 14, wanted: 4 },
    ],
  },
];

export const STORY_INTRO =
  'Tanjung Panas — kota pelabuhan yang tak pernah tidur. Raka, sopir kabur terbaik di kota, ' +
  'bekerja untuk Bu Sari, sang fixer yang mengatur segalanya dari warung kopinya di Pasar Lama. ' +
  'Enam pekerjaan. Satu malam panjang. Kalau berhasil, Raka bebas. Kalau gagal — penjara, atau lebih buruk.';
