const story = {
  start: {
    text: "Malam itu berkabut tebal. Kalian berdiri di depan gerbang Reruntuhan Aldenmoor yang tertutup rapat. Di sisi lain, terdengar suara air mengalir dari saluran pembuangan yang gelap.",
    choices: [
      { label: '🗡️ Terobos gerbang depan', next: 'courtyard_guard' },
      { label: '🕳️ Lewat selokan bawah tanah', next: 'sewer_rats' }
    ]
  },

  courtyard_guard: {
    enemy: {
      id: 'penjaga_terkutuk',
      name: 'Penjaga Terkutuk',
      hp: 40,
      atkMin: 5,
      atkMax: 8,
      def: 2
    },
    winNext: 'great_hall',
    text: "Kalian mendobrak gerbang! Di halaman, sesosok Ksatria Tanpa Kepala berjaga dengan pedang berkarat. Ia menoleh (atau setidaknya mencoba menoleh) ke arah kalian.",
    choices: [
      { label: '⚔️ Serang bersama!', next: 'fight_headless' },
      { label: '🗣️ Ajak bicara pelan-pelan', next: 'talk_headless' }
    ]
  },

  fight_headless: {
    text: "Pertarungan sengit! Kalian berhasil menjatuhkan ksatria itu, tapi salah satu dari kalian tergores pedang karatnya. Luka itu terasa dingin, seperti kutukan mulai merayap masuk. Kalian melangkah masuk lebih dalam, waspada.",
    setFlag: 'injured',
    choices: [
      { label: '➡️ Lanjut ke gerbang dalam', next: 'inner_gate' }
    ]
  },

  talk_headless: {
    text: "Ajaib, ksatria itu berhenti menyerang saat kalian bicara pelan. 'Perpustakaan... di sayap barat... jawabannya ada di sana,' desisnya sebelum mundur ke bayangan, membiarkan kalian lewat.",
    setFlag: 'knows_library_hint',
    choices: [
      { label: '➡️ Lanjut ke gerbang dalam', next: 'inner_gate' }
    ]
  },

  sewer_rats: {
    enemy: {
      id: 'tikus_raksasa',
      name: 'Tikus Raksasa',
      hp: 26,
      atkMin: 3,
      atkMax: 6,
      def: 0
    },
    winNext: 'great_hall',
    setFlag: 'has_map',
    text: "Baunya menyengat. Kalian merayap di selokan sempit. Tiba-tiba, sekawanan tikus raksasa seukuran anjing menghadang jalan kalian dengan mata merah menyala.",
    choices: [
      { label: '🔥 Bakar dengan obor', next: 'rats_burned' },
      { label: '🤫 Menyelinap pelan-pelan', next: 'rats_sneak' }
    ]
  },

  rats_burned: {
    text: "Api mengusir tikus-tikus itu, tapi asapnya membangunkan sesuatu di lantai atas — kalian dengar langkah berat mulai bergerak menuju arah kalian. Kalian buru-buru mencari jalan keluar.",
    setFlag: 'alerted_castle',
    choices: [
      { label: '➡️ Lari ke lorong rahasia', next: 'hidden_passage' }
    ]
  },

  rats_sneak: {
    text: "Kalian berhasil menyelinap tanpa suara. Di ujung selokan, cahaya redup menerangi sebuah pintu kayu tua setengah tertutup lumut.",
    choices: [
      { label: '➡️ Masuk lewat lorong rahasia', next: 'hidden_passage' }
    ]
  },

  hidden_passage: {
    text: "Kalian menemukan pintu rahasia di balik dinding berlumut. Di lantai, tergeletak peta tua kastil yang setengah lapuk.",
    choices: [
      { label: '🗺️ Ambil peta itu', next: 'inner_gate_mapped' },
      { label: '➡️ Abaikan, langsung masuk', next: 'inner_gate' }
    ]
  },

  inner_gate_mapped: {
    text: "Berbekal peta, kalian tahu ada jalan pintas ke perpustakaan sayap barat. Kalian melangkah masuk ke istana dengan lebih percaya diri.",
    setFlag: 'has_map',
    choices: [
      { label: '➡️ Masuk ke istana', next: 'inner_gate' }
    ]
  },

  // Convergence point setelah babak 1
  inner_gate: {
    text: "Kalian kini berdiri di lorong utama istana. Di depan, dua jalan terbentang: tangga menuju Perpustakaan Barat yang gelap, atau lorong lurus menuju Aula Utama tempat cahaya aneh berpendar.",
    choices: [
      { label: '📚 Jelajahi Perpustakaan Barat', next: 'library' },
      { label: '🏰 Langsung menuju Aula Utama', next: 'great_hall' }
    ]
  },

  // Side content opsional — buka jalan menuju ending terbaik
  library: {
    text: "Rak-rak buku berdebu memenuhi ruangan. Di salah satu buku yang masih utuh, kalian menemukan catatan seorang penyihir istana: cara sesungguhnya mematahkan kutukan tanpa menghancurkan Mahkota — sebuah ritual kuno yang butuh dua orang untuk dijalankan bersama.",
    setFlag: 'knows_true_ritual',
    choices: [
      { label: '➡️ Menuju Aula Utama', next: 'great_hall' }
    ]
  },

  great_hall: {
    text: "Kalian tiba di Aula Utama. Di tengah ruangan, Mahkota Aldenmoor bersinar redup di atas alas marmer. Namun, di sampingnya berdiri Arwah Sang Raja yang terlihat sedih.",
    choices: [
      { label: '👑 Ambil Mahkota itu!', next: 'ending_power' },
      { label: '👻 Dekati Arwah Sang Raja', next: 'spirit_dialogue' },
      { label: '🕯️ Lakukan ritual pembebasan', next: 'ending_true_freedom', requiresFlag: 'knows_true_ritual' }
    ]
  },

  spirit_dialogue: {
    text: "Arwah Sang Raja berbisik, 'Mahkota ini dikutuk. Siapapun yang memakainya akan terjebak selamanya di sini. Hancurkanlah agar jiwa kami bebas... atau, jika kalian berani, bantu aku memikul kutukan ini bersama, dan kita berdua akan bebas dengan cara berbeda.'",
    choices: [
      { label: '🔨 Hancurkan Mahkota', next: 'final_boss' },
      { label: '🏃 Ambil & Bawa Kabur', next: 'ending_betrayal' },
      { label: '🤝 Tawarkan menanggung kutukan bersama', next: 'ending_alliance' }
    ]
  },

  final_boss: {
    enemy: {
      id: 'raja_terkutuk',
      name: 'Raja Terkutuk',
      hp: 70,
      atkMin: 7,
      atkMax: 12,
      def: 4
    },
    winNext: 'ending_redemption',
    loseNext: 'ending_death',
    text: "👑💀 Sang arwah berubah wujud — Raja Terkutuk bangkit untuk mempertahankan mahkotanya!"
  },

  ending_power: {
    isEnding: true,
    endingTitle: '👑 Ending: Raja & Ratu Baru',
    text: "Kalian memakai Mahkota itu bersama. Seketika, kekuatan luar biasa mengalir di tubuh kalian, tapi kaki kalian berubah menjadi batu. Kalian menjadi penjaga abadi Aldenmoor selanjutnya."
  },

  ending_redemption: {
    isEnding: true,
    endingTitle: '🕊️ Ending: Sang Pembebas',
    text: "Kalian menghancurkan Mahkota itu! Terdengar jeritan keras, lalu kabut perlahan menghilang. Arwah Sang Raja tersenyum dan memudar. Kalian berhasil membebaskan Aldenmoor dari kutukan."
  },

  ending_betrayal: {
    isEnding: true,
    endingTitle: '💀 Ending: Pencuri Terkutuk',
    text: "Kalian mengambil Mahkota dan berlari keluar! Namun, semakin jauh kalian pergi, Mahkota itu semakin berat hingga menekan kalian ke tanah. Kalian terjebak dalam keserakahan selamanya."
  },

  ending_alliance: {
    isEnding: true,
    endingTitle: '🤝 Ending: Sekutu Abadi',
    text: "Kalian menggenggam tangan Arwah Sang Raja bersama-sama. Cahaya hangat menggantikan kabut dingin — kutukan itu terbelah tiga, ringan dipikul bertiga. Sang Raja kini bebas berkeliaran sebagai penasihat abadi kalian, dan Aldenmoor perlahan bangkit kembali sebagai rumah baru kalian, bukan penjara."
  },

  ending_true_freedom: {
    isEnding: true,
    endingTitle: '✨ Ending: Ritual Sejati',
    text: "Berkat pengetahuan dari Perpustakaan Barat, kalian menjalankan ritual kuno bersama-sama. Tanpa perlu menghancurkan apapun atau mengorbankan siapapun, kutukan terlepas sepenuhnya. Aldenmoor bangkit kembali sebagai kota yang hidup, dan kalian dikenang sebagai penyelamat sejatinya — ending terbaik yang hanya bisa dicapai lewat eksplorasi penuh."
  },

  ending_death: {
    isEnding: true,
    endingTitle: '💀 Ending: Gugur di Reruntuhan',
    text: "Kalian tumbang. Darah membasahi lantai batu Aldenmoor. Raja Terkutuk berdiri di atas tubuh kalian yang tak berdaya. Reruntuhan Aldenmoor menelan dua petualang lagi ke dalam kutukannya selamanya."
  }
};

module.exports = { story };
