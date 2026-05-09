let selectedBatch = null;
let selectedPrice = 0;
let selectedName = "";

// LOGIN
async function doLogin() {
  const phone = document.getElementById("reg-phone").value;

  const formattedPhone = "+234" + phone.replace(/^0/, "");

  const { error } = await supabase.auth.signInWithOtp({
    phone: formattedPhone
  });

  if (error) {
    console.error(error);
    alert("OTP failed");
  } else {
    alert("OTP sent successfully");
  }
}

// VERIFY OTP
async function verifyOtp() {
  const phone = "+234" + document.getElementById("reg-phone").value.replace(/^0/, "");

  const token = document.getElementById("otp").value;

  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms"
  });

  if (error) {
    console.error(error);
    alert("Invalid OTP");
  } else {
    alert("Login successful");

    loadMarketplace();
    checkAdminAccess();
  }
}

// REGISTRATION
async function submitRegistration() {
  try {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      alert("Please login first");
      return;
    }

    const user = userData.user;

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingUser) {
      alert("Profile already exists");
      return;
    }

    const { error: userError } = await supabase
      .from("users")
      .insert([
        {
          id: user.id,
          full_name: document.getElementById("reg-name").value,
          phone: document.getElementById("reg-phone").value,
          email: document.getElementById("reg-email").value,
          role: "beekeeper"
        }
      ]);

    if (userError) throw userError;

    const { error: beekeeperError } = await supabase
      .from("beekeepers")
      .insert([
        {
          user_id: user.id,
          state: document.getElementById("reg-state").value,
          lga: document.getElementById("reg-lga").value,
          village: document.getElementById("reg-village").value,
          experience_years: 1,
          hive_count: 0
        }
      ]);

    if (beekeeperError) throw beekeeperError;

    document.getElementById("reg-form-view").classList.add("hidden");

    document.getElementById("reg-success-view").classList.remove("hidden");

    alert("Registration complete");

  } catch (err) {
    console.error(err);
    alert("Registration failed");
  }
}

// CREATE BATCH
async function createBatch() {
  try {
    const { data: userData } = await supabase.auth.getUser();

    const { data: beekeeper } = await supabase
      .from("beekeepers")
      .select("id")
      .eq("user_id", userData.user.id)
      .single();

    const file = document.getElementById("batch-image")?.files[0];

    let imageUrl = null;

    if (file) {
      const fileName = Date.now() + "-" + file.name;

      await supabase.storage
        .from("honey-images")
        .upload(fileName, file);

      const { data: publicUrlData } = supabase.storage
        .from("honey-images")
        .getPublicUrl(fileName);

      imageUrl = publicUrlData.publicUrl;
    }

    const batchCode =
      "HT-" +
      new Date().getFullYear() +
      "-" +
      Math.floor(Math.random() * 100000);

    const { error } = await supabase
      .from("batches")
      .insert([
        {
          beekeeper_id: beekeeper.id,
          batch_code: batchCode,
          honey_type: "Forest Honey",
          harvest_date: new Date().toISOString(),
          quantity_available: 50,
          price_per_kg: 6500,
          image_url: imageUrl
        }
      ]);

    if (error) throw error;

    alert("Batch created successfully");

    loadMarketplace();
    loadAdminBatches();

  } catch (err) {
    console.error(err);
  }
}

// MARKETPLACE
async function loadMarketplace() {
  try {
    const { data, error } = await supabase
      .from("batches")
      .select("*");

    if (error) throw error;

    const container = document.getElementById("listings-wrap");

    container.innerHTML = data.map(batch => `
      <div class="market-card">

        ${batch.image_url ? `
          <img src="${batch.image_url}" />
        ` : ""}

        <h3>${batch.honey_type}</h3>

        <p>₦${batch.price_per_kg}/kg</p>

        <p>${batch.quantity_available}kg available</p>

        <p>
          ${batch.verified
            ? "✅ HoneyTrace Verified"
            : "⏳ Pending Verification"
          }
        </p>

        <button onclick="viewBatch('${batch.id}')">
          View Details
        </button>

        <button onclick="openOrderModal('${batch.id}', ${batch.price_per_kg}, '${batch.honey_type}')">
          Order Now
        </button>

      </div>
    `).join("");

  } catch (err) {
    console.error(err);
  }
}

// VIEW BATCH
async function viewBatch(batchId) {
  const { data, error } = await supabase
    .from("batches")
    .select(`
      *,
      beekeepers(
        state,
        lga,
        village
      )
    `)
    .eq("id", batchId)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  document.getElementById("batch-details").innerHTML = `
    <h2>${data.honey_type}</h2>

    <p><strong>Batch Code:</strong> ${data.batch_code}</p>

    <p>
      <strong>Status:</strong>
      ${data.verified ? "✅ Verified" : "⏳ Pending"}
    </p>

    <p>
      <strong>Location:</strong>
      ${data.beekeepers?.village || ""},
      ${data.beekeepers?.lga || ""},
      ${data.beekeepers?.state || ""}
    </p>
  `;

  document.getElementById("batch-modal").classList.remove("hidden");

  const verifyUrl = `https://yourdomain.vercel.app/verify.html?batch=${data.batch_code}`;

  QRCode.toCanvas(
    document.getElementById("qr-code"),
    verifyUrl
  );
}

function closeBatchModal() {
  document.getElementById("batch-modal").classList.add("hidden");
}

function openOrderModal(batchId, price, name) {
  selectedBatch = batchId;
  selectedPrice = price;
  selectedName = name;

 