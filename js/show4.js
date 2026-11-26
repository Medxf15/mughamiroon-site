// عرض اللقاء 4 «ليلة الفار»: غرفة الفار · الذاكرة الخارقة · فخ ولا آمن
(() => {
  "use strict";
  const CAR = [
    { n: "أُحد", c: "#ef8a33" },
    { n: "قُباء", c: "#0a63e6" },
    { n: "القبلتين", c: "#1fa865" },
    { n: "العقيق", c: "#db0000" },
  ];
  const KEY = "show4-scores";
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  // ───────── المحتوى ─────────
  const VAR_CASES = [
    { t: "الحالة التجريبية · بدون نقاط", q: "لاعب طلعت الكورة من الخط الجانبي بعد لمسته.", o: ["رمية تماس للخصم", "ركنية", "ركلة مرمى"], a: 1, w: "آخر من لمسها يخسر الرمية." },
    { t: "الحالة 1", q: "مدافع مسك الكورة بيده متعمّد على خط المرمى، ومنع هدف أكيد.", o: ["ركلة حرة", "ضربة جزاء وأصفر", "ضربة جزاء وأحمر"], a: 3, w: "منع هدف أكيد باليد = جزاء وطرد." },
    { t: "الحالة 2", q: "مهاجم كان في موقف تسلل، واستلم الكورة مباشرة من رمية تماس وسجّل.", o: ["الهدف صحيح", "تسلل والهدف ملغي", "تعاد الرمية"], a: 1, w: "ما فيه تسلل من رمية التماس." },
    { t: "الحالة 3", q: "لاعب رمى التماس ودخلت مرمى الخصم مباشرة بدون ما يلمسها أحد.", o: ["هدف", "ركلة مرمى للخصم", "ركنية"], a: 2, w: "ما يُحسب هدف من رمية تماس مباشرة." },
    { t: "الحالة 4", q: "لاعب سدد الركنية ودخلت المرمى مباشرة.", o: ["هدف صحيح", "ركلة مرمى", "تعاد الركنية"], a: 1, w: "الهدف من الركنية مباشرة صحيح." },
    { t: "الحالة 5", q: "لاعب سجّل وخلع قميصه وهو يحتفل.", o: ["الهدف ملغي", "الهدف صحيح بدون كرت", "الهدف صحيح وأصفر"], a: 3, w: "خلع القميص في الاحتفال = إنذار، والهدف يبقى." },
    { t: "الحالة 6", q: "مدافع رجّع الكورة لحارسه برجله متعمّد، والحارس مسكها بيده داخل منطقته.", o: ["ركلة حرة غير مباشرة للخصم", "اللعب مستمر", "ضربة جزاء"], a: 1, w: "الحارس ما يمسك التمريرة المتعمّدة بالرجل من زميله." },
    { t: "الحالة 7", q: "الكورة ضربت الحكم ودخلت المرمى مباشرة.", o: ["هدف", "ركلة مرمى", "كرة إسقاط"], a: 3, w: "الكورة اللي تلمس الحكم وتدخل المرمى ما تُحسب: كرة إسقاط." },
    { t: "الحالة 8", q: "الحارس سدد ركلة المرمى طويلة، ودخلت مرمى الخصم مباشرة.", o: ["هدف صحيح", "ركنية", "تعاد الركلة"], a: 1, w: "ركلة المرمى ممكن تسجّل مباشرة في مرمى الخصم." },
    { t: "الحالة 9", q: "آخر مدافع عرقل مهاجم منفرد بالمرمى خارج منطقة الجزاء، وما حاول يلعب الكورة.", o: ["ركلة حرة وأصفر", "ركلة حرة وأحمر", "ضربة جزاء"], a: 2, w: "منع فرصة هدف محققة = طرد." },
    { t: "الحالة 10", q: "لاعب قال للحكم كلمة مسيئة.", o: ["أصفر", "ما فيه شي", "أحمر"], a: 3, w: "الكلام المسيء = طرد مباشر." },
    { t: "الحالة 11", q: "مهاجم واقف متسلل بعيد، ما لمس الكورة وما أثّر على الحارس ولا على أحد، وزميله سجّل.", o: ["تسلل", "هدف صحيح", "ركلة حرة"], a: 2, w: "الوقوف في التسلل مو مخالفة إلا إذا شارك في اللعب." },
    { t: "الحالة 12", q: "في ضربة جزاء، الحارس تقدّم عن خطه بالرجلين قبل التسديد وصدّها.", o: ["صدّة محسوبة", "تعاد الضربة", "هدف"], a: 2, w: "الحارس لازم تكون رجل منه على الخط لحظة التسديد." },
    { t: "حالة الفاروق · بدون نقاط", q: "نفس الحالة 1: المدافع مسك الكورة بيده على الخط ومنع هدف أكيد… بس المدافع هذا من قافلتك أنت. وش قرارك؟", o: ["أجامل فريقي: ركلة حرة", "ضربة جزاء وأصفر", "ضربة جزاء وأحمر"], a: 3, w: "الحكم العادل قراره ما يتغير إذا الغلطان من فريقه. وعمر بن الخطاب رضي الله عنه لُقّب بالفاروق لأنه يفرّق بين الحق والباطل." },
  ];
  const VAR_EXTRA = [
    { t: "إعادة 1", q: "اللاعب سدد ضربة الجزاء، ضربت القائم ورجعت له، وسجّلها هو نفسه قبل ما يلمسها أحد.", o: ["هدف صحيح", "تعاد الضربة", "ركلة حرة غير مباشرة للخصم"], a: 3, w: "اللي سدد ما يلمسها ثاني قبل ما يلمسها لاعب ثاني." },
    { t: "إعادة 2", q: "الكورة طلعت كاملة فوق خط المرمى في الهواء، وبعدين انحرفت ورجعت للملعب.", o: ["اللعب مستمر", "خرجت: ركلة مرمى", "كرة إسقاط"], a: 2, w: "إذا عبرت الكورة الخط كاملة، حتى في الهواء، تعتبر خارج الملعب." },
    { t: "إعادة 3", q: "الحارس مسك الكورة بيده وقعد ماسكها وقت طويل يضيّع الوقت (أكثر من 6 ثواني).", o: ["ركلة حرة غير مباشرة للخصم", "ضربة جزاء", "ما فيه شي"], a: 1, w: "الحارس ما يمسك الكورة بيده أكثر من 6 ثواني." },
    { t: "إعادة 4", q: "لاعب داخل منطقة الجزاء رفع رجله عالي قرب راس الخصم بطريقة خطرة، بدون ما يلمسه.", o: ["ضربة جزاء", "ما فيه شي", "ركلة حرة غير مباشرة"], a: 3, w: "اللعب الخطر بدون لمس = ركلة حرة غير مباشرة." },
  ];

  const PRE15 = [["سيكل", "🚲"], ["جمل", "🐪"], ["مفتاح", "🔑"], ["طيارة", "✈️"], ["بطيخ", "🍉"], ["ساعة", "⌚"], ["كورة", "⚽"], ["أسد", "🦁"], ["شمسية", "☂️"], ["قلم", "✏️"], ["سيارة", "🚗"], ["ثلج", "🧊"], ["جوال", "📱"], ["نخلة", "🌴"], ["كتاب", "📘"]];
  const STORY = [["فيل", "🐘"], ["كيك", "🎂"], ["طبل", "🥁"], ["صاروخ", "🚀"], ["موز", "🍌"], ["بحر", "🌊"], ["كرسي", "🪑"], ["ديناصور", "🦖"], ["نظارة", "🕶️"], ["ذهب", "🪙"]];
  const STORY_LINES = [
    "🐘 فيل ضخم قاعد ياكل…",
    "🎂 كيكة كبيرة، وفجأة طلع من الكيكة…",
    "🥁 طبل يضرب لحاله! ومن قوة الصوت انطلق…",
    "🚀 صاروخ! الصاروخ نزل وتزحلق على…",
    "🍌 قشرة موز، وطاح في…",
    "🌊 البحر! ومن البحر طلع…",
    "🪑 كرسي يطفو، قاعد عليه…",
    "🦖 ديناصور! والديناصور لابس…",
    "🕶️ نظارة شمسية، ويوزّع على الناس…",
    "🪙 ذهب!",
  ];
  const OWN10 = [["قطة", "🐈"], ["برجر", "🍔"], ["كفر", "🛞"], ["ثعبان", "🐍"], ["شاهي", "🍵"], ["قطار", "🚂"], ["سرير", "🛏️"], ["بالون", "🎈"], ["عسل", "🍯"], ["قرش", "🦈"]];
  const PITCH = [
    { n: 1, p: "الحارس", x: 300, y: 740, w: "بطريق", e: "🐧", s: "بطريق واقف في المرمى، يصد بجناحينه." },
    { n: 2, p: "الظهير الأيمن", x: 500, y: 600, w: "مكنسة", e: "🧹", s: "يركض على الخط وهو يكنس الملعب بمكنسة." },
    { n: 3, p: "الظهير الأيسر", x: 100, y: 600, w: "شوكولاتة", e: "🍫", s: "رجوله غرقانة في شوكولاتة ذايبة." },
    { n: 4, p: "قلب الدفاع", x: 380, y: 630, w: "حصان", e: "🐎", s: "راكب حصان ويدافع من فوقه." },
    { n: 5, p: "قلب الدفاع", x: 220, y: 630, w: "مطر", e: "🌧️", s: "فوق راسه غيمة تمطر عليه هو بس." },
    { n: 6, p: "الوسط المدافع", x: 300, y: 500, w: "خيمة", e: "⛺", s: "ناصب خيمة في نص الملعب وقاعد فيها." },
    { n: 7, p: "الجناح الأيمن", x: 510, y: 240, w: "برق", e: "⚡", s: "كل ما ركض يطلع وراه برق." },
    { n: 8, p: "لاعب الوسط", x: 410, y: 390, w: "ساندويتش", e: "🥪", s: "يمرر ساندويتش بدل الكورة." },
    { n: 9, p: "المهاجم", x: 300, y: 150, w: "صقر", e: "🦅", s: "صقر يطير، يخطف الكورة ويسدد." },
    { n: 10, p: "صانع الألعاب", x: 190, y: 330, w: "تاج", e: "👑", s: "لابس تاج الملك وهو يلعب." },
    { n: 11, p: "الجناح الأيسر", x: 90, y: 240, w: "بركان", e: "🌋", s: "كل ما لمس الكورة ينفجر تحته بركان." },
  ];
  const BIG12A = [["زرافة", "🦒"], ["جيتار", "🎸"], ["بيتزا", "🍕"], ["مغناطيس", "🧲"], ["قلعة", "🏰"], ["سلطعون", "🦀"], ["كب كيك", "🧁"], ["هليكوبتر", "🚁"], ["طيارة ورق", "🪁"], ["بومة", "🦉"], ["ليمون", "🍋"], ["صحن طائر", "🛸"]];
  const BIG12B = [["سلحفاة", "🐢"], ["دبدوب", "🧸"], ["صبار", "🌵"], ["جوز هند", "🥥"], ["كورة سلة", "🏀"], ["حمار وحشي", "🦓"], ["كشاف", "🔦"], ["عنب", "🍇"], ["قارب", "🛶"], ["أخطبوط", "🐙"], ["قفاز", "🧤"], ["قنفذ", "🦔"]];

  const MSGS = [
    { app: "لعبة كورة أونلاين", from: "FREE_COINS_2026", av: "🎁", m: "مبروك!! فزت بـ 5000 كوينز 🎉 ادخل الرابط واكتب اسم حسابك وكلمة السر عشان نحوّلها لك.", v: 0, d: "هدية مجانية + كلمة سر = سرقة حساب. ما أرد، ما أعطي، أقول لأهلي." },
    { app: "رسالة نصية", from: "دعم اللعبة الرسمي", av: "🛡️", m: "حسابك بينقفل خلال ساعة! أرسل لنا الكود اللي وصلك برسالة الحين.", v: 0, d: "الكود اللي يجيك برسالة ما يعطيه أحد أبدًا، حتى لو قال إنه الدعم الرسمي." },
    { app: "دردشة اللعبة", from: "لاعب_ما_تعرفه", av: "👤", m: "انت لعيب 🔥 كم عمرك؟ وفي أي مدرسة؟ وين ساكن؟", v: 0, d: "العمر والمدرسة والحي معلومات خاصة. الغريب ما ياخذها." },
    { app: "قروب العائلة", from: "ولد خالتك", av: "👨‍👩‍👦", m: "العشا الليلة عند جدتي الساعة 8 لا تتأخرون 🙌", v: 1, d: "شخص تعرفه، وكلام عادي، وأهلك عارفين." },
    { rule: true },
    { app: "رسالة خاصة", from: "حساب جديد", av: "🙂", m: "أنا ولد عمري 11 مثلك 😄 خلنا نتكلم خاص… بس لا تقول لأهلك.", v: 0, d: "«لا تقول لأهلك» = فخ 100%. أي أحد يطلب السر من أهلك… قل لأهلك فورًا." },
    { app: "قروب الفصل", from: "صاحبك في الفصل", av: "📚", m: "وش واجب الرياضيات بكرة؟ صفحة كم؟", v: 1, d: "زميل تعرفه، وسؤال عادي." },
    { app: "دردشة اللعبة", from: "Pro_Gamer_SA", av: "🎮", m: "أعطيك سكن نادر مجاني 😍 بس صوّر لي بطاقة أبوك البنكية.", v: 0, d: "بطاقة البنك ما تنصوّر لأحد. هذي سرقة." },
    { app: "متجر التطبيقات", from: "المتجر الرسمي في جوالك", av: "⬇️", m: "يتوفر تحديث جديد للعبة. اضغط «تحديث».", v: 1, d: "التحديث من متجر الجوال الرسمي آمن. اسأل أهلك إذا ما تدري." },
    { app: "رسالة خاصة", from: "مدرب_أكاديمية", av: "⚽", m: "أرسل لي صورتك وصورة وجهك عشان أشوف إذا تصلح للفريق.", v: 0, d: "صورك ما ترسلها لغريب، حتى لو قال إنه مدرب." },
    { app: "رسالة خاصة", from: "رقم ما تعرفه", av: "🔗", m: "شوف هالفيديو المضحك عنك 😂😂 bit.ly/xxxx", v: 0, d: "الرابط من رقم ما تعرفه ما تفتحه. ممكن يسرق جوالك." },
    { app: "دردشة اللعبة", from: "صديق في اللعبة", av: "😠", m: "(صار يسب ويرسل كلام مو زين، ويقول: لو قلت لأحد بفضحك)", v: 0, d: "ما أرد، أحظره، وأقول لأهلي فورًا. التهديد هو الغلط، مو أنت." },
    { app: "رسالة خاصة", from: "واحد من اللعبة", av: "🏪", m: "بعطيك كوينز كثير لو قابلتني عند البقالة اللي جنبكم بكرة 👍", v: 0, d: "أخطر رسالة! أي غريب يبي يقابلك = تقول لأهلك فورًا." },
  ];

  const MODS = [
    {
      id: "var", icon: "📺", title: "غرفة الفار", tag: "فعالية 1 · 5:15 م · 25 د", desc: "حالات حقيقية من قانون الكورة. القافلة تتشاور همس، وحكمها يرفع القرار بأصابعه.",
      slides: () => [
        { type: "title", k: "فعالية 1", t: "غرفة الفار 📺", s: "الليلة أنتم الحكام… والحكم العادل ما يجامل حتى فريقه." },
        { type: "rules", t: "القاعدة", items: [["1", "أقرأ الحالة و3 خيارات."], ["2", "تتشاورون همس 20 ثانية."], ["3", "عند «قرار!» حكم القافلة يرفع 1 أو 2 أو 3 فوق راسه."], ["4", "كل حالة حكم جديد."], ["5", "اللي يرفع قبل الصافرة أو يغيّر بعدها = صفر."]], foot: "القرار الصح 2 · التشاور الهادئ 1 · × المستوى" },
        { type: "rules", t: "اختاروا مستواكم", items: [["أساسي", "حكم القافلة تختارونه أنتم بالدور · × 1"], ["متقدم", "بعد القرار أسأل حكمكم: ليش؟ · × 1.5"], ["خبير", "أنا أختار حكمكم لحظة الصافرة، ويقول السبب · × 2"]], foot: "ارفعوا أصابعكم: 1 أو 2 أو 3" },
        ...VAR_CASES.map((c) => ({ type: "case", ...c })),
        { type: "title", k: "احتياط", t: "حالات الإعادة", s: "إذا بقي وقت، أو في دكة الدوري، أو ختام ساعة المهارة." },
        ...VAR_EXTRA.map((c) => ({ type: "case", ...c })),
      ],
    },
    {
      id: "mem", icon: "🧠", title: "الذاكرة الخارقة", tag: "ساعة المهارة · 8:00 م · 35 د", desc: "قبل وبعد: كم يحفظ الولد بدون طريقة، وكم يحفظ بعد «القصة المجنونة» و«ملعب الذاكرة».",
      slides: () => [
        { type: "title", k: "ساعة المهارة", t: "الذاكرة الخارقة 🧠", s: "الليلة بتحفظ 15 شي بالترتيب… وبالعكس." },
        { type: "rules", t: "التحدي الأول: كم تقدر؟", items: [["⏱", "عندك 45 ثانية تشوف 15 كلمة."], ["🤐", "لا تكتب ولا تتكلم ولا تهمس."], ["🖐️", "بعدها كل واحد يعدّ على أصابعه كم كلمة تذكّر."], ["🔢", "هذا رقمك الشخصي الأول. احفظه، تقارن نفسك فيه بس."]] },
        { type: "mem", t: "التحدي الأول", items: PRE15, sec: 45 },
        { type: "rules", t: "ليش نسيت؟", items: [["🖼️", "المخ ينسى الكلمة… ويتذكر الصورة."], ["🤪", "يتذكر الشي الغريب والمضحك أكثر من العادي."], ["🏃", "ويتذكر الحركة والمكان."]], foot: "يعني: حوّل الكلمة لصورة غريبة تتحرك في مكان." },
        { type: "title", k: "الطريقة 1", t: "القصة المجنونة 🤪", s: "كل كلمة صورة، وكل صورة تسوي شي في اللي بعدها. كل ما صارت أغرب… ثبتت أكثر." },
        { type: "story", t: "اسمعوا القصة وتخيّلوها", lines: STORY_LINES },
        { type: "mem", t: "اختبار القصة (بدون ما تشوفون)", items: STORY, sec: 0 },
        { type: "rules", t: "دورك: ابنِ قصتك", items: [["⏱", "دقيقة كاملة تشوف 10 كلمات جديدة."], ["🎬", "ابنِ قصتك في راسك: كل كلمة تسوي شي في اللي بعدها."], ["🤐", "لحالك وبصمت."], ["🔢", "بعدها رقمك الشخصي الثاني."]] },
        { type: "mem", t: "قصتك أنت", items: OWN10, sec: 60 },
        { type: "title", k: "الطريقة 2", t: "ملعب الذاكرة ⚽", s: "عندك ملعب في راسك فيه 11 لاعب بأرقامهم. تحط كل كلمة على لاعب… وتمشي عليهم من 1 إلى 11." },
        { type: "pitch", mode: "learn", t: "تعرّف على ملعبك" },
        { type: "pitch", mode: "place", t: "نحط الكلمات على اللاعبين" },
        { type: "pitch", mode: "quiz", t: "اختبار الملعب" },
        { type: "rules", t: "التحدي الكبير بين القوافل", items: [["⏱", "40 ثانية تشوف 12 صورة."], ["🧠", "كل واحد يختار طريقته: القصة أو الملعب."], ["👉", "بعدها أنا أأشّر على ولد من كل قافلة بالدور: «رقم 7؟»"], ["⭐", "الجواب الصح 2 لقافلته · القافلة ساكتة 1"]] },
        { type: "mem", t: "التحدي الكبير", items: BIG12A, sec: 40, g4: true },
        { type: "mem", t: "تحدي احتياط", items: BIG12B, sec: 40, g4: true },
        { type: "rules", t: "وين تستخدمها؟", items: [["🛒", "قائمة المقاضي اللي تقولها أمك."], ["📚", "خطوات الدرس أو أسماء في الاجتماعيات."], ["📖", "ترتيب السور أو الآيات اللي تحفظها."], ["🏠", "التحدي المنزلي: خلّ أهلك يقولون لك 10 أشياء، احفظها بالملعب، وسمّعها لهم بالعكس."]] },
        { type: "title", k: "رقمك الشخصي", t: "قارن نفسك بنفسك", s: "رقمك في أول تحدي… ورقمك الحين. هذا الفرق هو تطورك أنت، مو مقارنة بأحد." },
      ],
    },
    {
      id: "trap", icon: "🎣", title: "فخ ولا آمن؟", tag: "ساعة المهارة · 8:40 م · 15 د", desc: "رسائل حقيقية تجيهم في الألعاب والجوال. فخ = يوقف، آمن = يجلس.",
      slides: () => [
        { type: "title", k: "ساعة المهارة", t: "فخ ولا آمن؟ 🎣", s: "رسائل تجيكم كل يوم في الألعاب والجوال. وحدة منها ممكن تسرق حسابك… أو أكثر." },
        { type: "rules", t: "القاعدة", items: [["📩", "أقرأ الرسالة."], ["🧍", "عند الصافرة: اللي يشوفها فخ يوقف."], ["🪑", "اللي يشوفها آمنة يجلس."], ["👉", "بعدها أختار واحد يقول: وش تسوي لو جتك؟"]], foot: "القافلة اللي كلها صح 2 · ساكتة وقت الكشف 1" },
        ...MSGS.map((m) => (m.rule ? { type: "rules", t: "القاعدة الذهبية", items: [["1", "ما أرد."], ["2", "ما أعطي: لا كلمة سر، ولا كود، ولا صورة، ولا عنوان."], ["3", "أقول لأهلي."]], foot: "أي أحد يقول «لا تقول لأهلك»… فخ 100%." } : { type: "msg", ...m })),
        { type: "rules", t: "علامات الفخ", items: [["🎁", "هدية مجانية أو كوينز."], ["🔑", "يطلب كلمة سر أو كود."], ["🏫", "يسأل عن عمرك ومدرستك وبيتك."], ["📸", "يبي صورتك."], ["🤫", "يقول «لا تقول لأهلك»."], ["📍", "يبي يقابلك."]] },
        { type: "rules", t: "لو وقعت في فخ؟", items: [["😌", "لا تخاف ولا تخبّي. الغلط على المحتال، مو عليك."], ["🗣️", "قل لأهلك فورًا."], ["🔒", "غيّر كلمة السر معهم."], ["🚫", "احظر الحساب وبلّغ عنه."]] },
      ],
    },
  ];

  // ───────── النقاط ─────────
  let scores = [0, 0, 0, 0];
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (Array.isArray(s) && s.length === 4) scores = s.map(Number); } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(scores)); } catch (e) { /* ignore */ } };
  function drawScores() {
    const sc = $("#sc"); sc.innerHTML = "";
    CAR.forEach((c, i) => {
      const chip = h("div", "chip"); chip.style.setProperty("--c", c.c);
      chip.innerHTML = `<b>${c.n}</b><button data-i="${i}" data-d="-1" aria-label="ناقص">−</button><span class="p">${scores[i]}</span><button data-i="${i}" data-d="1" aria-label="زائد">+</button>`;
      sc.appendChild(chip);
    });
  }
  $("#sc").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]"); if (!b) return;
    scores[+b.dataset.i] += +b.dataset.d; save(); drawScores();
    if (view === "board") render();
  });

  // ───────── المؤقت ─────────
  let tInt = null, actx = null;
  function beep(f = 880, d = 0.18, at = 0) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = f; o.type = "square"; g.gain.value = 0.12;
      o.connect(g); g.connect(actx.destination);
      const t0 = actx.currentTime + at; o.start(t0); o.stop(t0 + d);
    } catch (e) { /* ignore */ }
  }
  function startTimer(sec, onEnd) {
    const tm = $("#timer"), num = $("#tnum"), ring = $("#ring");
    clearInterval(tInt); tm.classList.add("on"); tm.classList.remove("done");
    let left = sec; num.textContent = left; ring.style.setProperty("--a", "360deg");
    beep(660, 0.12);
    tInt = setInterval(() => {
      left--; num.textContent = Math.max(left, 0);
      ring.style.setProperty("--a", (left / sec) * 360 + "deg");
      if (left <= 3 && left > 0) beep(700, 0.08);
      if (left <= 0) {
        clearInterval(tInt); tm.classList.add("done"); num.textContent = "قرار!";
        beep(990, 0.25); beep(990, 0.25, 0.32); beep(990, 0.5, 0.64);
        setTimeout(() => { tm.classList.remove("on"); if (onEnd) onEnd(); }, 1400);
      }
    }, 1000);
  }
  $("#timer").addEventListener("click", () => { clearInterval(tInt); $("#timer").classList.remove("on"); });
  document.querySelectorAll(".tb[data-t]").forEach((b) => b.addEventListener("click", () => startTimer(+b.dataset.t)));

  // ───────── العرض ─────────
  let view = "home", mod = null, slides = [], idx = 0, cur = null;
  const stage = $("#stage");

  function itemsGrid(items, opts = {}) {
    const g = h("div", "grid" + (opts.g4 ? " g4" : ""));
    items.forEach(([w, e], i) => { g.appendChild(h("div", "it", `<span class="k">${i + 1}</span><div class="e">${e}</div><div class="w">${w}</div>`)); });
    return g;
  }

  const R = {
    title(s) { const el = h("div", "slide", `${s.k ? `<p class="kick">${s.k}</p>` : ""}<h1>${s.t}</h1><p class="lead">${s.s || ""}</p>`); return { el }; },
    rules(s) {
      const el = h("div", "slide", `<h2>${s.t}</h2>`);
      const ul = h("ul", "rules"); s.items.forEach(([a, b]) => ul.appendChild(h("li", "", `<b>${a}</b><span>${b}</span>`))); el.appendChild(ul);
      if (s.foot) el.appendChild(h("p", "hint", s.foot));
      return { el };
    },
    case(s) {
      const el = h("div", "slide", `<p class="kick">${s.t}</p><p class="case">${s.q}</p>`);
      const ops = h("div", "opts"); s.o.forEach((o, i) => ops.appendChild(h("div", "opt", `<span class="n">${i + 1}</span><span>${o}</span>`))); el.appendChild(ops);
      const why = h("div", "why", `✅ الجواب: <b>${s.a}</b> — ${s.w}`); why.hidden = true; el.appendChild(why);
      const acts = h("div", "acts"); const bT = h("button", "ab y", "⏱ 20 ثانية تشاور"); const bR = h("button", "ab", "👁 كشف الجواب");
      acts.append(bT, bR); el.appendChild(acts);
      let shown = false;
      const reveal = () => { if (shown) return false; shown = true; [...ops.children].forEach((c, i) => c.classList.add(i + 1 === s.a ? "ok" : "no")); why.hidden = false; return true; };
      bT.addEventListener("click", () => startTimer(20)); bR.addEventListener("click", reveal);
      return { el, step: reveal };
    },
    story(s) {
      const el = h("div", "slide", `<h2>${s.t}</h2>`); const box = h("div", "story"); el.appendChild(box);
      let n = 0; const add = () => { if (n >= s.lines.length) return false; box.appendChild(h("p", "", s.lines[n++])); return true; };
      const acts = h("div", "acts"); const b = h("button", "ab", "التالي في القصة"); b.addEventListener("click", add); acts.appendChild(b); el.appendChild(acts);
      el.appendChild(h("p", "hint", "بعد ما تخلص: خلّ الكل يعيد القصة معك بصوت واحد من الفيل إلى الذهب… وبعدها بالعكس."));
      return { el, step: add };
    },
    mem(s) {
      const el = h("div", "slide"); let state = s.sec ? "ready" : "hidden", asked = [], curQ = null, revIdx = 0, tmr = null;
      const draw = () => {
        el.innerHTML = `<p class="kick">${s.t}</p>`;
        if (state === "ready") {
          el.appendChild(h("h2", "", `${s.items.length} ${s.items.length > 10 ? "صورة" : "صور"} · ${s.sec} ثانية`));
          el.appendChild(h("p", "lead", "الكل جاهز؟ عيونكم على الشاشة… وأفواهكم مسكّرة."));
          const a = h("div", "acts"); const b = h("button", "ab y", "▶ ابدأ العرض"); b.addEventListener("click", go); a.appendChild(b); el.appendChild(a);
        } else if (state === "show") {
          el.appendChild(itemsGrid(s.items, s)); const bar = h("div", "bar"); const i = h("i"); bar.appendChild(i); el.appendChild(bar);
          requestAnimationFrame(() => { i.style.transitionDuration = s.sec + "s"; i.style.width = "0%"; });
          const a = h("div", "acts"); const b = h("button", "ab alt", "إخفاء الحين"); b.addEventListener("click", hide); a.appendChild(b); el.appendChild(a);
        } else if (state === "hidden" || state === "q") {
          const q = h("div", "qbox");
          if (state === "hidden") q.innerHTML = `<div class="big">؟</div><p class="lead">اختفت! الحين أسألكم بالأرقام.</p>`;
          else q.innerHTML = `<p class="lead">الكلمة رقم</p><div class="big">${curQ + 1}</div><div id="rv"></div>`;
          el.appendChild(q);
          const a = h("div", "acts"); a.style.justifyContent = "center";
          const b1 = h("button", "ab y", "🎲 اسأل رقم"); b1.addEventListener("click", ask);
          const b2 = h("button", "ab", "👁 كشف"); b2.addEventListener("click", rev); if (state !== "q") b2.disabled = true;
          const b3 = h("button", "ab alt", "📋 مراجعة بالترتيب"); b3.addEventListener("click", () => { state = "review"; revIdx = 0; draw(); });
          const b4 = h("button", "ab alt", "⟲ من البداية"); b4.addEventListener("click", () => { state = s.sec ? "ready" : "hidden"; asked = []; draw(); });
          a.append(b1, b2, b3, b4); el.appendChild(a);
          el.appendChild(h("p", "hint", "تأشّر على ولد من القافلة اللي دورها، وتضغط «كشف» بعد ما يجاوب."));
        } else if (state === "review") {
          el.appendChild(h("p", "lead", "كل واحد يثني إصبع على كل كلمة تذكّرها بمكانها الصح. آخر شي: كم إصبع؟ هذا رقمك."));
          el.appendChild(itemsGrid(s.items.slice(0, revIdx), s));
          const a = h("div", "acts"); const b = h("button", "ab", revIdx < s.items.length ? `الكلمة ${revIdx + 1}` : "خلصت ✔");
          b.addEventListener("click", () => { if (revIdx < s.items.length) { revIdx++; draw(); } }); const bb = h("button", "ab alt", "↩ رجوع للأسئلة"); bb.addEventListener("click", () => { state = "hidden"; draw(); });
          a.append(b, bb); el.appendChild(a);
        }
      };
      function go() { state = "show"; draw(); clearTimeout(tmr); tmr = setTimeout(hide, s.sec * 1000); beep(660, 0.12); }
      function hide() { clearTimeout(tmr); if (state !== "show") return; state = "hidden"; draw(); beep(990, 0.3); }
      function ask() { if (asked.length >= s.items.length) asked = []; const left = s.items.map((_, i) => i).filter((i) => !asked.includes(i)); curQ = shuffle(left)[0]; asked.push(curQ); state = "q"; draw(); }
      function rev() { const r = $("#rv", el); if (!r || r.childElementCount) return false; const [w, e] = s.items[curQ]; r.appendChild(h("div", "reveal", `${e} ${w}`)); return true; }
      draw();
      return {
        el, step() {
          if (state === "ready") { go(); return true; }
          if (state === "show") { hide(); return true; }
          if (state === "hidden") { ask(); return true; }
          if (state === "q") { if (rev()) return true; ask(); return true; }
          if (state === "review") { if (revIdx < s.items.length) { revIdx++; draw(); return true; } return false; }
          return false;
        }, leave() { clearTimeout(tmr); },
      };
    },
    pitch(s) {
      const el = h("div", "slide", `<h2>${s.t}</h2>`); const wrap = h("div", "pitchwrap"); el.appendChild(wrap);
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg"); svg.setAttribute("viewBox", "0 0 600 820"); svg.setAttribute("class", "pitch");
      svg.innerHTML = `<rect x="10" y="10" width="580" height="800" rx="18" fill="#1f8a4c" stroke="#fff" stroke-width="4"/>
        <line x1="10" y1="410" x2="590" y2="410" stroke="#fff" stroke-width="3" opacity=".7"/><circle cx="300" cy="410" r="70" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>
        <rect x="150" y="660" width="300" height="150" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/><rect x="150" y="10" width="300" height="150" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>`;
      const nodes = PITCH.map((p) => {
        const g = document.createElementNS(svgNS, "g"); g.setAttribute("class", "pl"); g.setAttribute("transform", `translate(${p.x},${p.y})`);
        g.innerHTML = `<circle r="38"/><text class="num">${p.n}</text>`; svg.appendChild(g); return g;
      });
      wrap.appendChild(svg); const side = h("div", "side"); wrap.appendChild(side);
      let n = 0, q = null, order = shuffle(PITCH.map((_, i) => i)), qi = 0, rev = false;
      const setLabel = (i, word) => { const t = nodes[i].querySelector("text"); t.textContent = word ? PITCH[i].e : PITCH[i].n; t.setAttribute("class", word ? "em" : "num"); };
      const drawSide = () => {
        side.innerHTML = "";
        if (s.mode === "learn") {
          side.appendChild(h("p", "", "رقم القميص = المكان. نمشي بالترتيب:"));
          const ul = h("ul", "rules"); PITCH.slice(0, n).forEach((p) => ul.appendChild(h("li", "", `<b>${p.n}</b><span>${p.p}</span>`))); side.appendChild(ul);
          side.appendChild(h("p", "hint", "خلّهم يعدّونها معك بصوت واحد: واحد الحارس، اثنين الظهير الأيمن…"));
        } else if (s.mode === "place") {
          if (n === 0) side.appendChild(h("p", "", "كل لاعب ياخذ صورة غريبة. تخيّلها وهو يلعب!"));
          PITCH.slice(Math.max(0, n - 3), n).forEach((p) => side.appendChild(h("p", "", `<span class="tag">${p.n} · ${p.p}</span> ${p.e} <b>${p.w}</b>: ${p.s}`)));
          if (n >= PITCH.length) side.appendChild(h("p", "hint", "الحين امشوا معي على الملعب بصوت واحد: الحارس… بطريق! الظهير الأيمن… مكنسة!"));
        } else {
          if (q == null) side.appendChild(h("p", "", rev ? "بالعكس! من 11 إلى 1، الكل بصوت واحد." : "أأشّر على لاعب… وأنتم تقولون وش عنده."));
          else { side.appendChild(h("p", "", `<span class="tag">${PITCH[q].n}</span> ${PITCH[q].p}… وش عنده؟`)); }
          const a = h("div", "acts");
          const b1 = h("button", "ab y", "🎲 لاعب"); b1.addEventListener("click", askP);
          const b2 = h("button", "ab", "👁 كشف"); b2.addEventListener("click", revP);
          const b3 = h("button", "ab alt", "🔁 بالعكس"); b3.addEventListener("click", () => { rev = true; q = null; nodes.forEach((g, i) => { g.setAttribute("class", "pl"); setLabel(i, false); }); n = 0; drawSide(); });
          a.append(b1, b2, b3); side.appendChild(a);
        }
      };
      function addOne() {
        if (n >= PITCH.length) return false;
        const i = s.mode === "quiz" && rev ? PITCH.length - 1 - n : n;
        nodes[i].setAttribute("class", "pl on"); if (s.mode !== "learn") setLabel(i, true); n++; drawSide(); return true;
      }
      function askP() { if (q != null) { nodes[q].setAttribute("class", "pl"); setLabel(q, false); } if (qi >= order.length) { order = shuffle(order); qi = 0; } q = order[qi++]; nodes[q].setAttribute("class", "pl hl"); drawSide(); }
      function revP() { if (q == null) return false; if (nodes[q].querySelector("text.em")) return false; setLabel(q, true); return true; }
      drawSide();
      return {
        el, step() {
          if (s.mode === "quiz") { if (rev) return addOne(); if (q != null && revP()) return true; askP(); return true; }
          return addOne();
        },
      };
    },
    msg(s) {
      const el = h("div", "slide");
      el.innerHTML = `<div class="chat"><div class="hd"><span class="av">${s.av}</span><div><b>${s.from}</b><small>${s.app}</small></div></div><div class="bd"><div class="bub">${s.m}</div></div></div>`;
      const ver = h("div", "verdict", `<span class="v ${s.v ? "safe" : "trap"}">${s.v ? "آمن ✅" : "فخ ⚠️"}</span><p>${s.d}</p>`); ver.hidden = true; el.appendChild(ver);
      const how = h("div", "how", "<span>🧍 فخ = وقوف</span><span>🪑 آمن = جلوس</span>"); el.appendChild(how);
      const a = h("div", "acts"); a.style.justifyContent = "center";
      const bT = h("button", "ab y", "⏱ 10 ثواني"); bT.addEventListener("click", () => startTimer(10));
      const bR = h("button", "ab", "👁 كشف"); a.append(bT, bR); el.appendChild(a);
      let shown = false; const reveal = () => { if (shown) return false; shown = true; ver.hidden = false; how.hidden = true; return true; };
      bR.addEventListener("click", reveal);
      return { el, step: reveal };
    },
  };

  function render() {
    if (cur && cur.leave) cur.leave(); cur = null; stage.innerHTML = "";
    if (view === "home") {
      $("#ttl").textContent = "ليلة الفار · اللقاء 4"; $("#cnt").textContent = "";
      const el = h("div", "slide", `<p class="kick">المغامرون · نادي مهارة · حي الهجرة</p><h1>ليلة الفار</h1><p class="lead">اختر الفقرة. كل فقرة مستقلة، وتقدر توقف وين ما تبي وترجع هنا.</p>`);
      const g = h("div", "home");
      MODS.forEach((m) => { const b = h("button", "mod", `<div class="i">${m.icon}</div><h3>${m.title}</h3><p>${m.desc}</p><span class="t">${m.tag}</span>`); b.addEventListener("click", () => open(m)); g.appendChild(b); });
      el.appendChild(g);
      el.appendChild(h("p", "hint", "المسافة = خطوة داخل الشريحة (كشف، التالي في القصة…) · الأسهم = شريحة · النقاط تحت تنحفظ في هذا الجهاز."));
      stage.appendChild(el); return;
    }
    if (view === "board") {
      $("#ttl").textContent = "نقاط الليلة"; $("#cnt").textContent = "";
      const el = h("div", "slide", `<h2>نقاط الليلة في العرض</h2>`); const bd = h("div", "board"); const mx = Math.max(1, ...scores.map((x) => Math.abs(x)));
      CAR.forEach((c, i) => { const col = h("div", "col"); col.style.setProperty("--c", c.c); col.innerHTML = `<div class="pp">${scores[i]}</div><div class="bar2" style="height:${Math.max(0, scores[i]) / mx * 75}%"></div><div class="nm">${c.n}</div>`; bd.appendChild(col); });
      el.appendChild(bd);
      const a = h("div", "acts"); const b = h("button", "ab alt", "تصفير (اضغط مرتين)"); let armed = false;
      b.addEventListener("click", () => { if (!armed) { armed = true; b.textContent = "متأكد؟ اضغط مرة ثانية"; setTimeout(() => { armed = false; b.textContent = "تصفير (اضغط مرتين)"; }, 3000); return; } scores = [0, 0, 0, 0]; save(); drawScores(); render(); });
      const bk = h("button", "ab", "↩ رجوع"); bk.addEventListener("click", () => { view = mod ? "mod" : "home"; render(); });
      a.append(bk, b); el.appendChild(a);
      el.appendChild(h("p", "hint", "انقل هذي الأرقام لشاشة «سريع» في منصة المغامرين آخر الفقرة."));
      stage.appendChild(el); return;
    }
    const s = slides[idx]; cur = R[s.type](s); stage.appendChild(cur.el);
    $("#ttl").textContent = mod.title; $("#cnt").textContent = `${idx + 1} / ${slides.length}`;
  }
  function open(m) { mod = m; slides = m.slides(); idx = 0; view = "mod"; render(); }
  function go(d) { if (view !== "mod") return; const n = idx + d; if (n < 0 || n >= slides.length) { if (n >= slides.length) { view = "home"; mod = null; render(); } return; } idx = n; render(); }
  function step() { if (view !== "mod") return; if (cur && cur.step && cur.step()) return; go(1); }

  $("#bPrev").addEventListener("click", () => go(-1));
  $("#bNext").addEventListener("click", () => go(1));
  $("#bStep").addEventListener("click", step);
  $("#bHome").addEventListener("click", () => { view = "home"; mod = null; render(); });
  $("#bBoard").addEventListener("click", () => { view = "board"; render(); });
  $("#bFs").addEventListener("click", () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* ignore */ } });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("button") && (e.key === " " || e.key === "Enter")) { e.preventDefault(); }
    if (e.key === " " || e.key === "Enter" || e.key === "PageDown") { e.preventDefault(); step(); }
    else if (e.key === "ArrowLeft") go(1);
    else if (e.key === "ArrowRight" || e.key === "PageUp") go(-1);
    else if (e.key === "Escape") { $("#timer").classList.remove("on"); clearInterval(tInt); }
    else if (e.key === "t" || e.key === "ف") startTimer(20);
  });

  drawScores(); render();
})();
