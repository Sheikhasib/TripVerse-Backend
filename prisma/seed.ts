import bcrypt from "bcryptjs";
import { Role, UserStatus, PackageStatus, BookingStatus, PostStatus } from "../generated/prisma/enums";
import { prisma } from "../src/lib/prisma";

// Shared demo password so every seeded account is login-able the same way as
// the demo-login accounts (auth.service.ts uses the same "demo123").
const DEMO_PASSWORD = "demo123";
const saltRounds = 10;

// Explicit dates keep the Step 12 revenue trend and every dashboard chart
// populated — the trend buckets COMPLETED bookings by `updatedAt`, so history
// must be backdated rather than defaulting to "now".
const d = (y: number, m: number, day: number, h = 12): Date =>
  new Date(Date.UTC(y, m - 1, day, h));

// Cloudinary's public demo cloud — genuinely hosted, hotlink-safe, never a
// placeholder that 404s. One per package is enough; the shape allows several.
const IMAGES = {
  sundarbans: "https://res.cloudinary.com/demo/image/upload/forest.jpg",
  coxsBazar: "https://res.cloudinary.com/demo/image/upload/beach.jpg",
  bandarban: "https://res.cloudinary.com/demo/image/upload/mountain.jpg",
  dhaka: "https://res.cloudinary.com/demo/image/upload/city.jpg",
  sylhet: "https://res.cloudinary.com/demo/image/upload/tea.jpg",
  stMartin: "https://res.cloudinary.com/demo/image/upload/ocean.jpg",
  blogCover1: "https://res.cloudinary.com/demo/image/upload/blog-travel.jpg",
  blogCover2: "https://res.cloudinary.com/demo/image/upload/blog-festival.jpg",
  blogCover3: "https://res.cloudinary.com/demo/image/upload/blog-foods.jpg",
  blogCover4: "https://res.cloudinary.com/demo/image/upload/blog-tips.jpg",
};

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      // ── 1. Reset (dependency order so FKs never block) ─────────────────
      await tx.review.deleteMany();
      await tx.booking.deleteMany();
      await tx.blogPost.deleteMany();
      await tx.tourPackage.deleteMany();
      await tx.category.deleteMany();
      await tx.contactMessage.deleteMany();
      await tx.user.deleteMany();

      // ── 2. Categories (5) ─────────────────────────────────────────────
    const categoryNames = [
      "Beaches",
      "Adventure",
      "Nature & Wildlife",
      "City Tours",
      "Cultural & Heritage",
    ];

    const categories = new Map<string, string>();
    for (const name of categoryNames) {
      const category = await tx.category.create({
        data: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") },
      });
      categories.set(name, category.id);
    }

    // ── 3. Users (demo trio + 5 customers) ──────────────────────────────
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, saltRounds);

    const seedUsers = [
      { name: "Demo User", email: "demo-user@tripverse.com", role: Role.USER },
      { name: "Demo Agent", email: "demo-agent@tripverse.com", role: Role.AGENT },
      { name: "Demo Admin", email: "demo-admin@tripverse.com", role: Role.ADMIN },
    ];

    const customerUsers = Array.from({ length: 5 }, (_, i) => ({
      name: `Demo Customer ${i + 1}`,
      email: `demo-customer-${i + 1}@tripverse.com`,
      role: Role.USER,
    }));

    const userMap = new Map<string, string>();
    for (const u of [...seedUsers, ...customerUsers]) {
      const user = await tx.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hashedPassword,
          role: u.role,
          status: UserStatus.ACTIVE,
          authProvider: "CREDENTIAL",
          emailVerified: true,
        },
      });
      userMap.set(u.email, user.id);
    }

    const adminId = userMap.get("demo-admin@tripverse.com")!;
    const agentId = userMap.get("demo-agent@tripverse.com")!;
    const demoUserId = userMap.get("demo-user@tripverse.com")!;
    const customers = [1, 2, 3, 4, 5].map((i) => userMap.get(`demo-customer-${i}@tripverse.com`)!);

    // ── 4. Packages (6 approved) ────────────────────────────────────────
    const packages = [
      {
        title: "Sundarbans Wildlife Expedition",
        slug: "sundarbans-wildlife-expedition",
        description:
          "A 3-day guided expedition into the world's largest mangrove forest. Cruise the river channels, spot the iconic Royal Bengal tiger, and watch a sky full of migratory birds at sunset. Includes an expert naturalist guide, boat safari, and eco-lodge stays.",
        location: "Khulna",
        price: 149.99,
        duration: 3,
        rating: 4.7,
        category: "Nature & Wildlife",
        image: IMAGES.sundarbans,
      },
      {
        title: "Cox's Bazar Beach Escape",
        slug: "coxs-bazar-beach-escape",
        description:
          "Unwind on the longest natural sea beach in the world. Days of swimming, beach volleyball and fresh seafood, plus a sunset boat ride to the fishing port. Includes ocean-view hotel and daily beach breakfast.",
        location: "Cox's Bazar",
        price: 199.5,
        duration: 4,
        rating: 4.5,
        category: "Beaches",
        image: IMAGES.coxsBazar,
      },
      {
        title: "Bandarban Trekking Adventure",
        slug: "bandarban-trekking-adventure",
        description:
          "Trek through the green hills of Bandarban to the highest peaks of the country. Cross hanging bridges, stay with indigenous communities, and wake up above a sea of clouds. A must for serious hikers.",
        location: "Bandarban",
        price: 249.99,
        duration: 5,
        rating: 4.9,
        category: "Adventure",
        image: IMAGES.bandarban,
      },
      {
        title: "Dhaka Heritage City Walk",
        slug: "dhaka-heritage-city-walk",
        description:
          "Walk the storied streets of Old Dhaka — from the pink Lalbagh Fort to the star mosque and the riverine Sadarghat port. Tasting stops for biryani, hand-rolled paan and sweets are woven into every tour.",
        location: "Dhaka",
        price: 59.0,
        duration: 1,
        rating: 4.3,
        category: "City Tours",
        image: IMAGES.dhaka,
      },
      {
        title: "Sylhet Tea Garden Retreat",
        slug: "sylhet-tea-garden-retreat",
        description:
          "Three days among the rolling green carpets of Sylhet's tea estates. Visit a working tea factory, cruise a crystal-clear lake in a country boat, and hike to a rainbow-waterfall viewpoint.",
        location: "Sylhet",
        price: 129.75,
        duration: 3,
        rating: 4.6,
        category: "Nature & Wildlife",
        image: IMAGES.sylhet,
      },
      {
        title: "St Martin Island Diving",
        slug: "st-martin-island-diving",
        description:
          "Dive and snorkel the coral reefs of Bangladesh's only coral island. Beach-side bungalows, fresh lobster dinners, and sunset walks on the clean white sand. Includes a certified dive guide and all gear.",
        location: "St Martin",
        price: 299.99,
        duration: 4,
        rating: 4.8,
        category: "Beaches",
        image: IMAGES.stMartin,
      },
    ];

    const packageMap = new Map<string, string>();
    for (const pkg of packages) {
      const created = await tx.tourPackage.create({
        data: {
          title: pkg.title,
          slug: pkg.slug,
          description: pkg.description,
          location: pkg.location,
          price: pkg.price,
          duration: pkg.duration,
          rating: pkg.rating,
          images: [pkg.image],
          status: PackageStatus.APPROVED,
          agentId,
          categoryId: categories.get(pkg.category)!,
          createdAt: d(2026, 3, 1),
          updatedAt: d(2026, 3, 1),
        },
      });
      packageMap.set(pkg.slug, created.id);
    }

    // ── 5. Bookings (~18 across months/statuses) ────────────────────────
    // totalPrice is computed server-side the same way the service does it
    // (price × travelers), rounded to 2dp.
    const priceFor = (slug: string) => packages.find((p) => p.slug === slug)!.price;

    const bookingSeeds = [
      // COMPLETED — past travel dates, backdated updatedAt → revenue + reviews
      { slug: "sundarbans-wildlife-expedition", user: customers[0], travelers: 2, status: BookingStatus.COMPLETED, travel: d(2026, 4, 12), created: d(2026, 3, 20), updated: d(2026, 4, 13) },
      { slug: "sundarbans-wildlife-expedition", user: customers[1], travelers: 1, status: BookingStatus.COMPLETED, travel: d(2026, 5, 9), created: d(2026, 4, 25), updated: d(2026, 5, 10) },
      { slug: "sundarbans-wildlife-expedition", user: demoUserId, travelers: 3, status: BookingStatus.COMPLETED, travel: d(2026, 6, 14), created: d(2026, 5, 30), updated: d(2026, 6, 15) },
      { slug: "coxs-bazar-beach-escape", user: customers[0], travelers: 2, status: BookingStatus.COMPLETED, travel: d(2026, 4, 20), created: d(2026, 4, 1), updated: d(2026, 4, 21) },
      { slug: "coxs-bazar-beach-escape", user: demoUserId, travelers: 4, status: BookingStatus.COMPLETED, travel: d(2026, 6, 5), created: d(2026, 5, 15), updated: d(2026, 6, 6) },
      { slug: "bandarban-trekking-adventure", user: customers[2], travelers: 1, status: BookingStatus.COMPLETED, travel: d(2026, 5, 25), created: d(2026, 5, 2), updated: d(2026, 5, 26) },
      { slug: "dhaka-heritage-city-walk", user: customers[0], travelers: 2, status: BookingStatus.COMPLETED, travel: d(2026, 4, 8), created: d(2026, 3, 28), updated: d(2026, 4, 9) },
      { slug: "sylhet-tea-garden-retreat", user: customers[3], travelers: 2, status: BookingStatus.COMPLETED, travel: d(2026, 7, 11), created: d(2026, 6, 20), updated: d(2026, 7, 12) },
      { slug: "st-martin-island-diving", user: customers[4], travelers: 2, status: BookingStatus.COMPLETED, travel: d(2026, 7, 4), created: d(2026, 5, 30), updated: d(2026, 7, 5) },
      // CONFIRMED — future travel
      { slug: "coxs-bazar-beach-escape", user: customers[1], travelers: 2, status: BookingStatus.CONFIRMED, travel: d(2026, 8, 20), created: d(2026, 7, 25), updated: d(2026, 7, 26) },
      { slug: "sundarbans-wildlife-expedition", user: customers[4], travelers: 1, status: BookingStatus.CONFIRMED, travel: d(2026, 9, 5), created: d(2026, 8, 1), updated: d(2026, 8, 2) },
      { slug: "bandarban-trekking-adventure", user: customers[0], travelers: 3, status: BookingStatus.CONFIRMED, travel: d(2026, 9, 18), created: d(2026, 8, 10), updated: d(2026, 8, 11) },
      // PENDING — future travel
      { slug: "dhaka-heritage-city-walk", user: customers[2], travelers: 1, status: BookingStatus.PENDING, travel: d(2026, 8, 25), created: d(2026, 8, 12), updated: d(2026, 8, 12) },
      { slug: "sylhet-tea-garden-retreat", user: customers[1], travelers: 2, status: BookingStatus.PENDING, travel: d(2026, 9, 15), created: d(2026, 8, 14), updated: d(2026, 8, 14) },
      { slug: "st-martin-island-diving", user: demoUserId, travelers: 2, status: BookingStatus.PENDING, travel: d(2026, 10, 3), created: d(2026, 8, 15), updated: d(2026, 8, 15) },
      // CANCELLED
      { slug: "coxs-bazar-beach-escape", user: customers[2], travelers: 1, status: BookingStatus.CANCELLED, travel: d(2026, 5, 30), created: d(2026, 5, 10), updated: d(2026, 5, 12) },
      { slug: "st-martin-island-diving", user: customers[0], travelers: 4, status: BookingStatus.CANCELLED, travel: d(2026, 6, 28), created: d(2026, 6, 1), updated: d(2026, 6, 3) },
      { slug: "bandarban-trekking-adventure", user: customers[1], travelers: 2, status: BookingStatus.CANCELLED, travel: d(2026, 7, 20), created: d(2026, 7, 4), updated: d(2026, 7, 6) },
    ];

    for (const b of bookingSeeds) {
      await tx.booking.create({
        data: {
          userId: b.user,
          packageId: packageMap.get(b.slug)!,
          travelDate: b.travel,
          travelers: b.travelers,
          totalPrice: Math.round(priceFor(b.slug) * b.travelers * 100) / 100,
          status: b.status,
          createdAt: b.created,
          updatedAt: b.updated,
        },
      });
    }

    // ── 6. Reviews (6, only on packages the reviewer completed) ─────────
    const reviewSeeds: {
      slug: string;
      user: string;
      rating: number;
      comment: string;
    }[] = [
      { slug: "sundarbans-wildlife-expedition", user: customers[0], rating: 5, comment: "Saw a tiger! The guide was phenomenal and the boat safari was unforgettable." },
      { slug: "sundarbans-wildlife-expedition", user: customers[1], rating: 4, comment: "Gorgeous mangroves and great birdwatching. Eco-lodge bed was a bit firm." },
      { slug: "sundarbans-wildlife-expedition", user: demoUserId, rating: 5, comment: "Worth every taka. Sunset over the river was magical." },
      { slug: "coxs-bazar-beach-escape", user: customers[0], rating: 4, comment: "Perfect family beach trip. Sunset boat ride was the highlight." },
      { slug: "bandarban-trekking-adventure", user: customers[2], rating: 5, comment: "Toughest trek I've done — and the best. The cloud sea at dawn is unreal." },
      { slug: "dhaka-heritage-city-walk", user: customers[0], rating: 4, comment: "Old Dhaka packed with history and flavour. Bring an empty stomach." },
      { slug: "sylhet-tea-garden-retreat", user: customers[3], rating: 5, comment: "Green as far as the eye can see. The tea factory tour was fascinating." },
      { slug: "st-martin-island-diving", user: customers[4], rating: 5, comment: "Coral reefs were teeming with life. Lobster dinner on the beach, chef's kiss." },
    ];

    for (const r of reviewSeeds) {
      await tx.review.create({
        data: {
          userId: r.user,
          packageId: packageMap.get(r.slug)!,
          rating: r.rating,
          comment: r.comment,
        },
      });
    }

    // Recompute package ratings from seeded reviews (rounded to 1dp), so the
    // dashboard's averageRating reflects reality.
    for (const slug of packageMap.keys()) {
      const id = packageMap.get(slug)!;
      const { _avg } = await tx.review.aggregate({
        where: { packageId: id },
        _avg: { rating: true },
      });
      await tx.tourPackage.update({
        where: { id },
        data: { rating: Math.round((_avg.rating ?? 0) * 10) / 10 },
      });
    }

    // ── 7. Blog posts (3 published + 1 draft) ───────────────────────────
    const posts = [
      {
        title: "Trekking the Green Hills of Bandarban: A Complete Guide",
        slug: "trekking-the-green-hills-of-bandarban",
        excerpt: "Everything you need to know before hiking Bandarban's famous peaks — best seasons, packing list, and the top routes.",
        content:
          "Bandarban is the trekking capital of Bangladesh, home to the country's highest peaks. The best time to visit is between November and March, when the trails are dry and the mornings begin with a sea of clouds below the summits. Pack sturdy boots, plenty of water, and light layers — the temperature drops fast in the evening. Stay overnight in indigenous village homestays to experience local hospitality, and never skip sunrise from the peaks; it is the single most memorable moment of the entire trip.",
        coverImage: IMAGES.blogCover1,
        status: PostStatus.PUBLISHED,
        authorId: adminId,
        createdAt: d(2026, 6, 10),
        updatedAt: d(2026, 6, 10),
      },
      {
        title: "A Food Lover's Weekend in Old Dhaka",
        slug: "a-food-lovers-weekend-in-old-dhaka",
        excerpt: "Biryani, kacchi, faluda and hand-rolled beef shawarma — a curated eating tour of the capital's historic lanes.",
        content:
          "Old Dhaka is a feast for the senses. Start your morning at a legendary kacchi biryani house, then wander the lanes sampling hand-rolled shawarma, steaming jhalmuri, and pan-fried hilsa. Afternoon is for faluda and the famous star mosque photo ops, and you cannot leave without a box of misti from the sweet shops lining the old bazaar. Carry a healthy appetite, follow the locals' queues, and you will eat better in forty-eight hours than most people do in a year.",
        coverImage: IMAGES.blogCover3,
        status: PostStatus.PUBLISHED,
        authorId: agentId,
        createdAt: d(2026, 6, 22),
        updatedAt: d(2026, 6, 23),
      },
      {
        title: "5 Travel Tips for First-Timers Visiting the Sundarbans",
        slug: "5-travel-tips-for-first-timers-sundarbans",
        excerpt: "Practical advice for your first mangrove expedition — from insect repellent to respecting tiger territory.",
        content:
          "The Sundarbans rewards preparation. Book a licensed boat tour and always travel with a naturalist guide. Bring strong insect repellent as the forest teems with mosquitoes at dusk. Carry your own water and snacks, as supplies on the boats are limited. Keep quiet and still near riverbanks when scanning for wildlife — the tigers and deer are easily spooked. Finally, remember this is a fragile ecosystem: take nothing but photographs and leave nothing but footprints.",
        coverImage: IMAGES.blogCover2,
        status: PostStatus.PUBLISHED,
        authorId: adminId,
        createdAt: d(2026, 7, 5),
        updatedAt: d(2026, 7, 5),
      },
      {
        title: "The Hidden Gems of Sylhet (Draft)",
        slug: "the-hidden-gems-of-sylhet",
        excerpt: "Draft post — off the beaten path waterfalls and tea gardens worth the detour.",
        content:
          "Most visitors stop at Sylhet's famous tea gardens and leave, but the real magic lies in the hill tracts beyond — isolated waterfalls, shimmering haor lakes, and villages where time seems to stand still. (Draft — complete research and photos before publishing.)",
        coverImage: IMAGES.blogCover4,
        status: PostStatus.DRAFT,
        authorId: agentId,
        createdAt: d(2026, 7, 20),
        updatedAt: d(2026, 7, 20),
      },
    ];

    for (const p of posts) {
      await tx.blogPost.create({
        data: {
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          content: p.content,
          coverImage: p.coverImage,
          status: p.status,
          authorId: p.authorId,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        },
      });
    }

    // ── 8. Summary ──────────────────────────────────────────────────────
    const counts = {
      users: await tx.user.count(),
      categories: await tx.category.count(),
      packages: await tx.tourPackage.count(),
      bookings: await tx.booking.count(),
      reviews: await tx.review.count(),
      posts: await tx.blogPost.count(),
    };
    console.log("Seed complete:", JSON.stringify(counts));
    },
    { timeout: 60000 },
  );
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());