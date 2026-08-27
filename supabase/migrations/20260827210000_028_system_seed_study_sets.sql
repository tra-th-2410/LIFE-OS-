-- Migration 028: System Study Sets & Public Seed Data
-- Allows system-curated study sets (is_system = TRUE, user_id = NULL) accessible to all users

-- 1. Alter study_sets table
ALTER TABLE study_sets ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE study_sets ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Update RLS Policies for study_sets
DROP POLICY IF EXISTS "study_sets_select" ON study_sets;
CREATE POLICY "study_sets_select" ON study_sets
  FOR SELECT TO authenticated, anon
  USING (is_system = TRUE OR user_id = auth.uid());

DROP POLICY IF EXISTS "study_sets_insert" ON study_sets;
CREATE POLICY "study_sets_insert" ON study_sets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_system = FALSE);

DROP POLICY IF EXISTS "study_sets_update" ON study_sets;
CREATE POLICY "study_sets_update" ON study_sets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_system = FALSE)
  WITH CHECK (user_id = auth.uid() AND is_system = FALSE);

DROP POLICY IF EXISTS "study_sets_delete" ON study_sets;
CREATE POLICY "study_sets_delete" ON study_sets
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND is_system = FALSE);

-- 3. Update RLS Policies for study_questions
DROP POLICY IF EXISTS "study_questions_select" ON study_questions;
CREATE POLICY "study_questions_select" ON study_questions
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM study_sets
      WHERE study_sets.id = study_questions.set_id
      AND (study_sets.is_system = TRUE OR study_sets.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "study_questions_insert" ON study_questions;
CREATE POLICY "study_questions_insert" ON study_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_sets
      WHERE study_sets.id = study_questions.set_id
      AND study_sets.user_id = auth.uid()
      AND study_sets.is_system = FALSE
    )
  );

DROP POLICY IF EXISTS "study_questions_update" ON study_questions;
CREATE POLICY "study_questions_update" ON study_questions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_sets
      WHERE study_sets.id = study_questions.set_id
      AND study_sets.user_id = auth.uid()
      AND study_sets.is_system = FALSE
    )
  );

DROP POLICY IF EXISTS "study_questions_delete" ON study_questions;
CREATE POLICY "study_questions_delete" ON study_questions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_sets
      WHERE study_sets.id = study_questions.set_id
      AND study_sets.user_id = auth.uid()
      AND study_sets.is_system = FALSE
    )
  );

-- 4. Clean up any existing system seed data before re-inserting to prevent duplicates
DELETE FROM study_sets WHERE is_system = TRUE;

-- 5. Seed System Study Sets & Questions
DO $$
DECLARE
  -- Math Sets
  v_set_math1 UUID;
  v_set_math2 UUID;
  -- Physics Sets
  v_set_phys1 UUID;
  v_set_phys2 UUID;
  -- Chemistry Sets
  v_set_chem1 UUID;
  v_set_chem2 UUID;
  -- English Sets
  v_set_eng1 UUID;
  v_set_eng2 UUID;
  -- Literature Sets
  v_set_lit1 UUID;
  v_set_lit2 UUID;
  -- Geography Sets
  v_set_geo1 UUID;
  v_set_geo2 UUID;
  -- History Sets
  v_set_hist1 UUID;
  v_set_hist2 UUID;
  -- IT Sets
  v_set_it1 UUID;
  v_set_it2 UUID;
BEGIN

  -- =========================================================================
  -- 1. TOÁN HỌC (MATH)
  -- =========================================================================
  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Định lý Thales & Hình học tam giác', 'math', 'Định lý Thales', 'Kiến thức trọng tâm về Định lý Thales thuận, đảo và hệ quả trong tam giác', 'multiple_choice', TRUE)
  RETURNING id INTO v_set_math1;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_math1, 'multiple_choice', 'Cho tam giác $ABC$, đường thẳng $d$ song song với $BC$ cắt $AB, AC$ lần lượt tại $M, N$. Hệ thức nào sau đây đúng theo định lý Thales thuận?', '{"A": "$\\frac{AM}{AB} = \\frac{AN}{AC}$", "B": "$\\frac{AM}{MB} = \\frac{AN}{AC}$", "C": "$\\frac{AM}{AB} = \\frac{NC}{AN}$", "D": "$\\frac{MB}{AB} = \\frac{AN}{AC}"}'::jsonb, 'A', '$\frac{AM}{AB} = \frac{AN}{AC}$', 'Định lý Thales thuận: Nếu một đường thẳng song song với một cạnh của tam giác và cắt hai cạnh còn lại thì nó định ra trên hai cạnh đó những đoạn thẳng tương ứng tỉ lệ.', 0),
    (v_set_math1, 'flashcard', 'Phát biểu Định lý Thales đảo trong tam giác', NULL, NULL, 'Nếu một đường thẳng cắt hai cạnh của một tam giác và định ra trên hai cạnh này những đoạn thẳng tương ứng tỉ lệ thì đường thẳng đó song song với cạnh còn lại của tam giác.', 'Định lý Thales đảo dùng để chứng minh hai đường thẳng song song.', 1),
    (v_set_math1, 'fill_blank', 'Hệ quả định lý Thales: Nếu một đường thẳng cắt hai cạnh của tam giác và song song với cạnh còn lại thì nó tạo thành một tam giác mới có ba cạnh tương ứng ___ với ba cạnh của tam giác đã cho.', NULL, NULL, 'tỉ lệ', 'Hệ quả: $\frac{AM}{AB} = \frac{AN}{AC} = \frac{MN}{BC}$.', 2);

  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Hình học & Đạo hàm cực trị', 'math', 'Hình học cơ bản', 'Công thức diện tích, thể tích hình khối và cực trị hàm số', 'flashcard', TRUE)
  RETURNING id INTO v_set_math2;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_math2, 'flashcard', 'Công thức tính thể tích khối chóp có diện tích đáy $B$ và chiều cao $h$ là gì?', NULL, NULL, '$V = \frac{1}{3}B \cdot h$', 'Khối chóp bằng một phần ba diện tích đáy nhân với chiều cao.', 0),
    (v_set_math2, 'multiple_choice', 'Công thức tính diện tích toàn phần của hình trụ tròn xoay có bán kính đáy $R$ và chiều cao $h$ là:', '{"A": "$S_{tp} = 2\\pi R h + 2\\pi R^2$", "B": "$S_{tp} = \\pi R h + \\pi R^2$", "C": "$S_{tp} = 2\\pi R h + \\pi R^2$", "D": "$S_{tp} = 4\\pi R^2$"}'::jsonb, 'A', '$S_{tp} = 2\pi R h + 2\pi R^2$', 'Diện tích toàn phần hình trụ gồm diện tích xung quanh $2\pi Rh$ cộng với diện tích 2 đáy $2\pi R^2$.', 1),
    (v_set_math2, 'fill_blank', 'Điều kiện cần để hàm số $y=f(x)$ đạt cực trị tại điểm $x_0$ có đạo hàm là $f''(x_0) = ___$', NULL, NULL, '0', 'Nếu $f(x)$ có đạo hàm tại $x_0$ và đạt cực trị tại đó thì $f''(x_0) = 0$.', 2);

  -- =========================================================================
  -- 2. VẬT LÝ (PHYSICS)
  -- =========================================================================
  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Công thức Dao động điều hòa & Sóng cơ', 'physics', 'Dao động cơ', 'Tổng hợp công thức con lắc lò xo, con lắc đơn và sóng cơ học', 'flashcard', TRUE)
  RETURNING id INTO v_set_phys1;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_phys1, 'flashcard', 'Chu kỳ dao động của con lắc lò xo có khối lượng $m$ và độ cứng $k$ được tính bằng công thức nào?', NULL, NULL, '$T = 2\pi\sqrt{\frac{m}{k}}$', 'Tần số góc $\omega = \sqrt{\frac{k}{m}}$, do đó chu kỳ $T = \frac{2\pi}{\omega} = 2\pi\sqrt{\frac{m}{k}}$.', 0),
    (v_set_phys1, 'multiple_choice', 'Chu kỳ dao động điều hòa của con lắc đơn có chiều dài dây $l$ tại nơi có gia tốc trọng trường $g$ là:', '{"A": "$T = 2\\pi\\sqrt{\\frac{l}{g}}$", "B": "$T = 2\\pi\\sqrt{\\frac{g}{l}}$", "C": "$T = \\frac{1}{2\\pi}\\sqrt{\\frac{l}{g}}$", "D": "$T = 2\\pi\\sqrt{\\frac{m}{k}}$"}'::jsonb, 'A', '$T = 2\pi\sqrt{\frac{l}{g}}$', 'Chu kỳ con lắc đơn chỉ phụ thuộc vào chiều dài dây $l$ và gia tốc rơi tự do $g$, không phụ thuộc vào khối lượng con lắc.', 1),
    (v_set_phys1, 'fill_blank', 'Bước sóng $\lambda$ là quãng đường sóng truyền đi được trong một ___ dao động.', NULL, NULL, 'chu kỳ', 'Công thức liên hệ: $\lambda = v \cdot T = \frac{v}{f}$.', 2);

  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Chuyển động thẳng & Định luật Newton', 'physics', 'Chuyển động cơ học', 'Các công thức chuyển động biến đổi đều và các định luật động lực học', 'multiple_choice', TRUE)
  RETURNING id INTO v_set_phys2;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_phys2, 'multiple_choice', 'Công thức liên hệ giữa vận tốc, gia tốc và quãng đường trong chuyển động thẳng biến đổi đều là:', '{"A": "$v^2 - v_0^2 = 2as$", "B": "$v - v_0 = 2as$", "C": "$v^2 + v_0^2 = 2as$", "D": "$s = vt + \\frac{1}{2}at^2$"}'::jsonb, 'A', '$v^2 - v_0^2 = 2as$', 'Công thức độc lập thời gian giúp tính toán nhanh khi không biết biến $t$.', 0),
    (v_set_phys2, 'flashcard', 'Phát biểu Định luật II Newton dạng véctơ', NULL, NULL, '$\vec{F} = m\vec{a}$ (hay $\vec{a} = \frac{\vec{F}}{m}$)', 'Gia tốc của một vật cùng hướng với lực tác dụng lên vật. Độ lớn của gia tốc tỉ lệ thuận với độ lớn của lực và tỉ lệ nghịch với khối lượng của vật.', 1),
    (v_set_phys2, 'fill_blank', 'Trong chuyển động rơi tự do từ độ cao $h$, thời gian rơi chạm đất được tính bởi công thức $t = \sqrt{\frac{2h}{___}}$', NULL, NULL, 'g', 'Do $h = \frac{1}{2}gt^2 \implies t = \sqrt{\frac{2h}{g}}$.', 2);

  -- =========================================================================
  -- 3. HÓA HỌC (CHEMISTRY)
  -- =========================================================================
  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Bảng tuần hoàn & Este - Lipit', 'chemistry', 'Nguyên tố & Hợp chất', 'Cấu hình electron, liên kết hóa học và tính chất của este', 'multiple_choice', TRUE)
  RETURNING id INTO v_set_chem1;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_chem1, 'multiple_choice', 'Este no, đơn chức, mạch hở có công thức phân tử tổng quát là:', '{"A": "$C_n H_{2n} O_2$ ($n \\ge 2$)", "B": "$C_n H_{2n+2} O_2$ ($n \\ge 1$)", "C": "$C_n H_{2n-2} O_2$ ($n \\ge 3$)", "D": "$C_n H_{2n} O$ ($n \\ge 2$)"}'::jsonb, 'A', '$C_n H_{2n} O_2$ ($n \ge 2$)', 'Este no đơn chức mạch hở tạo bởi axit no đơn chức và ancol no đơn chức, có $k=1$ (1 liên kết đôi $C=O$).', 0),
    (v_set_chem1, 'flashcard', 'Phản ứng xà phòng hóa este là gì?', NULL, NULL, 'Là phản ứng thủy phân este trong môi trường kiềm (dung dịch NaOH hoặc KOH), tạo ra muối của axit cacboxylic và ancol.', 'Phản ứng xà phòng hóa là phản ứng một chiều (hoàn toàn).', 1),
    (v_set_chem1, 'fill_blank', 'Dầu chuối là este có mùi thơm đặc trưng của chuối chín, có tên gọi hóa học là isoamyl ___', NULL, NULL, 'axetat', 'Isoamyl axetat có công thức $CH_3COOCH_2CH_2CH(CH_3)_2$.', 2);

  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Phản ứng Oxi hóa - Khử & Axit Bazơ', 'chemistry', 'Phản ứng hóa học', 'Cân bằng phản ứng electron, tính pH và định luật bảo toàn', 'fill_blank', TRUE)
  RETURNING id INTO v_set_chem2;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_chem2, 'fill_blank', 'Dung dịch có $[H^+] = 10^{-3}\text{ M}$ thì giá trị pH bằng ___', NULL, NULL, '3', 'Công thức tính pH: $\text{pH} = -\log[H^+] = -\log(10^{-3}) = 3$.', 0),
    (v_set_chem2, 'flashcard', 'Chất khử là chất nhường hay nhận electron?', NULL, NULL, 'Chất khử là chất nhường electron (chất bị oxi hóa, số oxi hóa tăng sau phản ứng).', 'Quy tắc ghi nhớ: "Khử cho - O nhận" (Chất khử cho e, chất oxi hóa nhận e).', 1),
    (v_set_chem2, 'multiple_choice', 'Khí nào sau đây gây ra hiện tượng mưa axit chính trong khí quyển?', '{"A": "$SO_2$ và $NO_2$", "B": "$CO_2$ và $CH_4$", "C": "$O_2$ và $N_2$", "D": "$H_2$ và $He$"}'::jsonb, 'A', '$SO_2$ và $NO_2$', '$SO_2$ và $NO_x$ khi gặp nước mưa tạo thành axit $H_2SO_4$ và $HNO_3$ gây mưa axit.', 2);

  -- =========================================================================
  -- 4. TIẾNG ANH (ENGLISH)
  -- =========================================================================
  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Environment & Climate Change Vocab', 'english', 'Từ vựng theo chủ đề', 'Key vocabulary for IELTS & High School English: Environment topic', 'flashcard', TRUE)
  RETURNING id INTO v_set_eng1;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_eng1, 'flashcard', 'Biodiversity (n.)', NULL, NULL, 'Đa dạng sinh học — The variety of plant and animal life in a particular habitat or in the world.', 'Example: Preserving biodiversity is essential for ecological balance.', 0),
    (v_set_eng1, 'multiple_choice', 'Choose the word closest in meaning to "Renewable energy":', '{"A": "Sustainable energy", "B": "Fossil fuel", "C": "Exhaustible power", "D": "Nuclear waste"}'::jsonb, 'A', 'Sustainable energy', 'Renewable energy (năng lượng tái tạo) refers to energy from sources that naturally replenish, like wind and solar.', 1),
    (v_set_eng1, 'fill_blank', 'The continuous clearing of rain forests is known as ___ (sự phá rừng).', NULL, NULL, 'deforestation', 'Deforestation /diːˌfɔːr.əˈsteɪ.ʃən/ leads to loss of animal habitats and accelerated global warming.', 2);

  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Grammar trọng tâm: Conditional Sentences & Passives', 'english', 'Grammar cơ bản', 'Mastering Conditional Types 1, 2, 3 and Passive Voice', 'multiple_choice', TRUE)
  RETURNING id INTO v_set_eng2;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_eng2, 'multiple_choice', 'If I ___ you, I would accept that scholarship immediately.', '{"A": "were", "B": "am", "C": "was been", "D": "had been"}'::jsonb, 'A', 'were', 'Câu điều kiện loại 2 (giả định trái ngược với hiện tại): If + S + were/V-ed, S + would/could + V-bare.', 0),
    (v_set_eng2, 'flashcard', 'Cấu trúc câu điều kiện loại 3 (trái ngược với quá khứ) là gì?', NULL, NULL, 'If + S + had + V3/V-ed, S + would/could + have + V3/V-ed', 'Diễn tả một sự việc đã không xảy ra trong quá khứ và kết quả giả định của nó.', 1),
    (v_set_eng2, 'fill_blank', 'Chuyển sang bị động: "They have built a new bridge." => "A new bridge has ___ built."', NULL, NULL, 'been', 'Thì hiện tại hoàn thành ở thể bị động: S + have/has + been + V3/V-ed.', 2);

  -- =========================================================================
  -- 5. NGỮ VĂN (LITERATURE)
  -- =========================================================================
  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Tác phẩm Văn học Trung học phổ thông', 'literature', 'Tác phẩm văn học', 'Tác giả, hoàn cảnh sáng tác và giá trị nội dung nghệ thuật', 'multiple_choice', TRUE)
  RETURNING id INTO v_set_lit1;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_lit1, 'multiple_choice', 'Tác phẩm "Vợ nhặt" của nhà văn Kim Lân được in trong tập truyện nào?', '{"A": "Con chó xấu xí", "B": "Nên vợ nên chồng", "C": "Gió đầu mùa", "D": "Làng"}'::jsonb, 'A', 'Con chó xấu xí', '"Vợ nhặt" tiền thân là tiểu thuyết "Xóm ngụ cư", sau hòa bình lập lại tác giả viết lại thành truyện ngắn in trong tập "Con chó xấu xí" (1962).', 0),
    (v_set_lit1, 'flashcard', 'Tác giả và năm sáng tác bài thơ "Tây Tiến"', NULL, NULL, 'Nhà thơ Quang Dũng, sáng tác năm 1948 tại Phù Lưu Chanh.', 'Bài thơ khắc họa bức tượng đài bi tráng về người lính Tây Tiến trên nền thiên nhiên miền Tây hùng vĩ, hiểm trở.', 1),
    (v_set_lit1, 'fill_blank', 'Tập thơ "Nhật ký trong tù" (Ngục trung nhật ký) được Chủ tịch Hồ Chí Minh viết bằng chữ ___ trong những năm 1942 - 1943.', NULL, NULL, 'Hán', 'Gồm 133 bài thơ bằng chữ Hán thể hiện tinh thần thép và tâm hồn nghệ sĩ lớn.', 2);

  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Biện pháp Tu từ Tiếng Việt & Phong cách văn bản', 'literature', 'Biện pháp tu từ', 'Nhận diện và phân tích tác dụng của các phép tu từ từ vựng và cú pháp', 'flashcard', TRUE)
  RETURNING id INTO v_set_lit2;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_lit2, 'flashcard', 'Phân biệt Ẩn dụ và Hoán dụ', NULL, NULL, 'Ẩn dụ dựa trên mối quan hệ tương đồng (giống nhau); Hoán dụ dựa trên mối quan hệ tương cận (gần gũi, đi đôi với nhau).', 'Ví dụ: "Mặt trời của bắp" là ẩn dụ; "Áo chàm đưa buổi phân ly" là hoán dụ.', 0),
    (v_set_lit2, 'multiple_choice', 'Câu thơ "Thuyền về có nhớ bến chăng / Bến thì một dạ khăng khăng đợi thuyền" sử dụng biện pháp tu từ nào nổi bật?', '{"A": "Ẩn dụ", "B": "Hoán dụ", "C": "Nói quá", "D": "Chơi chữ"}'::jsonb, 'A', 'Ẩn dụ', '"Thuyền" ẩn dụ cho người ra đi (chàng trai); "Bến" ẩn dụ cho người ở lại (cô gái).', 1),
    (v_set_lit2, 'fill_blank', 'Biện pháp tu từ lặp lại từ ngữ hoặc cấu trúc câu để nhấn mạnh cảm xúc hoặc tạo nhịp điệu được gọi là phép ___', NULL, NULL, 'điệp', 'Bao gồm điệp từ, điệp ngữ, điệp cấu trúc.', 2);

  -- =========================================================================
  -- 6. ĐỊA LÝ (GEOGRAPHY)
  -- =========================================================================
  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Địa lý Tự nhiên & Vùng kinh tế Việt Nam', 'geography', 'Địa lý Việt Nam', 'Đặc điểm khí hậu, địa hình, tài nguyên và 7 vùng kinh tế', 'multiple_choice', TRUE)
  RETURNING id INTO v_set_geo1;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_geo1, 'multiple_choice', 'Địa hình nước ta có đặc điểm nổi bật nào sau đây?', '{"A": "Đồi núi chiếm 3/4 diện tích lãnh thổ, chủ yếu là đồi núi thấp", "B": "Đồng bằng chiếm 3/4 diện tích", "C": "Núi cao trên 2000m chiếm phần lớn diện tích", "D": "Địa hình có hướng duy nhất là vòng cung"}'::jsonb, 'A', 'Đồi núi chiếm 3/4 diện tích lãnh thổ, chủ yếu là đồi núi thấp', 'Đồi núi thấp dưới 1000m chiếm tới 85% diện tích cả nước, núi cao trên 2000m chỉ chiếm 1%.', 0),
    (v_set_geo1, 'flashcard', 'Hai hướng chính của địa hình Việt Nam là gì?', NULL, NULL, 'Hướng Tây Bắc - Đông Nam và hướng Vòng cung.', 'Hướng TB - ĐN tiêu biểu ở vùng Tây Bắc và Trường Sơn Bắc; Hướng vòng cung tiêu biểu ở vùng Đông Bắc và Trường Sơn Nam.', 1),
    (v_set_geo1, 'fill_blank', 'Gió mùa mùa đông ở miền Bắc nước ta có hướng thổi chính là hướng ___', NULL, NULL, 'Đông Bắc', 'Gió mùa Đông Bắc hoạt động từ tháng 11 đến tháng 4 năm sau tạo nên mùa đông lạnh ở miền Bắc.', 2);

  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Địa lý Thế giới & Hiệp hội ASEAN', 'geography', 'Địa lý thế giới', 'Các khối liên minh kinh tế, dân số và chuyển dịch cơ cấu toàn cầu', 'flashcard', TRUE)
  RETURNING id INTO v_set_geo2;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_geo2, 'flashcard', 'Hiệp hội các quốc gia Đông Nam Á (ASEAN) được thành lập vào năm nào?', NULL, NULL, 'Năm 1967 tại Băng Cốc (Thái Lan) với 5 quốc gia sáng lập.', 'Việt Nam chính thức gia nhập ASEAN vào ngày 28/07/1995.', 0),
    (v_set_geo2, 'multiple_choice', 'Kênh đào Suez nối liền hai vùng biển nào?', '{"A": "Địa Trung Hải và Biển Đỏ", "B": "Đại Tây Dương và Thái Bình Dương", "C": "Biển Đen và Biển Ban-tích", "D": "Biển Đỏ và Vịnh Ba Tư"}'::jsonb, 'A', 'Địa Trung Hải và Biển Đỏ', 'Kênh đào Suez rút ngắn hành trình hàng hải quốc tế giữa châu Âu và châu Á.', 1),
    (v_set_geo2, 'fill_blank', 'Quốc gia có diện tích lãnh thổ lớn nhất thế giới hiện nay là ___', NULL, NULL, 'Liên bang Nga', 'Diện tích Liên bang Nga đạt trên 17 triệu km².', 2);

  -- =========================================================================
  -- 7. LỊCH SỬ (HISTORY)
  -- =========================================================================
  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Lịch sử Việt Nam: 1945 - 1975', 'history', 'Lịch sử Việt Nam', 'Các mốc lịch sử quan trọng: CMT8 1945, Điện Biên Phủ 1954, Giải phóng miền Nam 1975', 'multiple_choice', TRUE)
  RETURNING id INTO v_set_hist1;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_hist1, 'multiple_choice', 'Bản Tuyên ngôn Độc lập khai sinh ra nước Việt Nam Dân chủ Cộng hòa được Chủ tịch Hồ Chí Minh đọc tại Quảng trường Ba Đình vào ngày nào?', '{"A": "02/09/1945", "B": "19/08/1945", "C": "02/09/1946", "D": "30/04/1975"}'::jsonb, 'A', '02/09/1945', 'Ngày 2/9/1945 là ngày Quốc khánh của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.', 0),
    (v_set_hist1, 'flashcard', 'Ý nghĩa lịch sử của Chiến thắng Điện Biên Phủ (07/05/1954)', NULL, NULL, 'Đập tan hoàn toàn kế hoạch Nava của Pháp - Mỹ, buộc Pháp phải ký Hiệp định Giơ-ne-vơ công nhận độc lập, chủ quyền của Việt Nam.', '"Lừng lẫy năm châu, chấn động địa cầu".', 1),
    (v_set_hist1, 'fill_blank', 'Chiến dịch giải phóng Sài Gòn mang tên Chiến dịch ___ kết thúc thắng lợi vào ngày 30/4/1975.', NULL, NULL, 'Hồ Chí Minh', 'Chiến dịch Hồ Chí Minh lịch sử đã thống nhất non sông Việt Nam.', 2);

  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Lịch sử Thế giới Hiện đại & Liên Hợp Quốc', 'history', 'Lịch sử thế giới', 'Trật tự thế giới sau Chiến tranh thế giới thứ hai và vai trò của UN', 'flashcard', TRUE)
  RETURNING id INTO v_set_hist2;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_hist2, 'flashcard', 'Mục đích chính của tổ chức Liên Hợp Quốc (UN) khi thành lập năm 1945 là gì?', NULL, NULL, 'Duy trì hòa bình và an ninh thế giới, phát triển các mối quan hệ hữu nghị giữa các dân tộc và tiến hành hợp tác quốc tế.', 'Hiến chương Liên Hợp Quốc có hiệu lực vào ngày 24/10/1945.', 0),
    (v_set_hist2, 'multiple_choice', 'Sự kiện nào đánh dấu sự chấm dứt của Trật tự thế giới hai cực Ianta và Chiến tranh Lạnh?', '{"A": "Sự sụp đổ của Liên bang Xô Viết (1991)", "B": "Thành lập NATO (1949)", "C": "Chiến tranh Triều Tiên (1950)", "D": "Khủng hoảng tên lửa Cuba (1962)"}'::jsonb, 'A', 'Sự sụp đổ của Liên bang Xô Viết (1991)', 'Năm 1991, Liên Xô tan rã, Trật tự hai cực Ianta sụp đổ, thế giới chuyển sang xu thế đa cực.', 1),
    (v_set_hist2, 'fill_blank', 'Cơ quan giữ vai trò trọng yếu nhất trong việc duy trì hòa bình và an ninh quốc tế của Liên Hợp Quốc là Hội đồng ___', NULL, NULL, 'Bảo an', 'Gồm 5 ủy viên thường trực (Mỹ, Nga, Trung Quốc, Anh, Pháp) và 10 ủy viên không thường trực.', 2);

  -- =========================================================================
  -- 8. TIN HỌC (IT)
  -- =========================================================================
  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Cấu trúc Dữ liệu & Thuật toán cơ bản', 'it', 'Lập trình cơ bản', 'Độ phức tạp thuật toán, cấu trúc dữ liệu Stack, Queue, Array và Binary Search', 'multiple_choice', TRUE)
  RETURNING id INTO v_set_it1;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_it1, 'multiple_choice', 'Thuật toán tìm kiếm nhị phân (Binary Search) trên mảng đã sắp xếp có độ phức tạp thời gian trong trường hợp xấu nhất là:', '{"A": "$O(\\log n)$", "B": "$O(n)$", "C": "$O(n \\log n)$", "D": "$O(1)$"}'::jsonb, 'A', '$O(\log n)$', 'Mỗi bước so sánh chia đôi không gian tìm kiếm nên độ phức tạp là $O(\log_2 n)$.', 0),
    (v_set_it1, 'flashcard', 'Nguyên lý hoạt động của cấu trúc dữ liệu Stack (Ngăn xếp)', NULL, NULL, 'LIFO (Last In, First Out) — Phần tử đưa vào sau cùng sẽ được lấy ra đầu tiên.', 'Hai thao tác cơ bản: push (thêm vào đỉnh) và pop (lấy ra từ đỉnh).', 1),
    (v_set_it1, 'fill_blank', 'Cấu trúc dữ liệu Queue (Hàng đợi) hoạt động theo nguyên lý ___ (First In, First Out).', NULL, NULL, 'FIFO', 'Phần tử được đưa vào đầu tiên sẽ được lấy ra đầu tiên.', 2);

  INSERT INTO study_sets (title, subject, topic, description, default_type, is_system)
  VALUES ('Mạng máy tính & Cơ sở dữ liệu SQL', 'it', 'Công nghệ thông tin', 'Giao thức HTTP/HTTPS, mô hình Client-Server và truy vấn SQL', 'flashcard', TRUE)
  RETURNING id INTO v_set_it2;

  INSERT INTO study_questions (set_id, type, question, options, correct_option, answer, explanation, sort_order)
  VALUES
    (v_set_it2, 'flashcard', 'Sự khác biệt chính giữa HTTP và HTTPS là gì?', NULL, NULL, 'HTTPS được mã hóa bảo mật thông qua giao thức SSL/TLS (cổng 443), còn HTTP truyền dữ liệu dạng văn bản thô (cổng 80) không được mã hóa.', 'Chữ "S" trong HTTPS là viết tắt của "Secure".', 0),
    (v_set_it2, 'multiple_choice', 'Từ khóa SQL nào dùng để loại bỏ các dòng dữ liệu trùng lặp trong kết quả truy vấn SELECT?', '{"A": "DISTINCT", "B": "UNIQUE", "C": "GROUP BY", "D": "ORDER BY"}'::jsonb, 'A', 'DISTINCT', 'Cú pháp: `SELECT DISTINCT column_name FROM table_name;`', 1),
    (v_set_it2, 'fill_blank', 'Khóa chính (Primary Key) trong cơ sở dữ liệu quan hệ có 2 đặc tính bắt buộc: Duy nhất (Unique) và không được chứa giá trị ___', NULL, NULL, 'NULL', 'Primary Key = UNIQUE + NOT NULL.', 2);

END $$;
