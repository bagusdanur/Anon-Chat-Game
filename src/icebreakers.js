const questions = [
  "Kalau kamu bisa punya kekuatan super, kamu pilih apa?",
  "Apa hal paling memalukan yang pernah terjadi sama kamu?",
  "Lebih suka jalan-jalan ke gunung atau ke pantai? Kenapa?",
  "Film atau series terakhir yang bikin kamu nangis atau ketawa banget?",
  "Kalau kamu menang lotre 10 miliar hari ini, besok kamu bakal lakuin apa?",
  "Pilih: bisa terbang atau bisa baca pikiran orang?",
  "Apa lagu yang selalu bikin kamu semangat lagi pas lagi sedih?",
  "Kalau kamu cuma bisa makan satu jenis makanan seumur hidup, kamu pilih apa?",
  "Momen paling bahagia dalam hidup kamu sejauh ini?",
  "Apa ketakutan terbesar kamu yang jarang orang tahu?",
  "Kalau waktu bisa diputar balik, kamu mau ubah apa di masa lalu?",
  "Siapa tokoh fiksi yang pengen banget kamu ajak nongkrong bareng?",
  "Pernah punya pengalaman horor/mistis nggak? Ceritain dong!",
  "Lebih milih jadi orang miskin tapi bahagia, atau kaya raya tapi kesepian?",
  "Hal receh apa yang akhir-akhir ini bikin kamu senyum?",
  "Kalau disuruh mendeskripsikan diri kamu dalam 3 kata, apa aja?",
  "Apa hal yang paling kamu banggakan dari diri sendiri?",
  "Sebutkan satu hal yang belum pernah kamu lakuin tapi pengen banget dicoba!",
  "Kalau kamu bisa hidup di dunia game/film, kamu mau hidup di mana?",
  "Apa mimpi masa kecil yang belum kesampaian sampai sekarang?"
];

function getRandomTopic() {
  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}

module.exports = {
  getRandomTopic
};
