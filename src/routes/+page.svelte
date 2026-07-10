<script>
  import { LogIn, PlusCircle } from '@lucide/svelte';
</script>

<svelte:head>
  <title>Web Games</title>
  <meta name="description" content="Starte eine neue Party oder tritt einer bestehenden Party bei." />
</svelte:head>

<main class="min-h-screen bg-slate-50 text-slate-950">
  <section class="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:px-10">
    <div>
      <div class="max-w-2xl">
        <img src="/images/decor/lobby.png" alt="" aria-hidden="true" class="mb-4 h-20 w-20 animate-decor-float object-contain sm:h-24 sm:w-24" />
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">Web Games</p>
        <h1 class="mt-4 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
          Was moechtest du tun?
        </h1>
        <p class="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
          Starte direkt eine neue Party oder tritt mit einem Code einer bestehenden Runde bei.
        </p>
      </div>

      <div class="mt-10 grid gap-4 sm:grid-cols-2">
        <a
          href="/party/starten"
          class="group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-cyan-100"
          aria-label="Neue Party starten"
        >
          <img src="/images/decor/lobby.png" alt="" aria-hidden="true" class="absolute right-3 top-3 h-14 w-14 object-contain opacity-80 transition group-hover:scale-105 sm:h-16 sm:w-16" />
          <span class="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-600 text-white">
            <PlusCircle size={24} strokeWidth={2.2} />
          </span>
          <span>
            <span class="block text-2xl font-semibold text-slate-950">Party starten</span>
            <span class="mt-2 block text-sm leading-6 text-slate-600">
              Erstelle eine neue Runde und lade andere Spieler ein.
            </span>
          </span>
        </a>

        <a
          href="/party/beitreten"
          class="group flex min-h-44 flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-100"
          aria-label="Einer Party beitreten"
        >
          <span class="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-600 text-white">
            <LogIn size={24} strokeWidth={2.2} />
          </span>
          <span>
            <span class="block text-2xl font-semibold text-slate-950">Party beitreten</span>
            <span class="mt-2 block text-sm leading-6 text-slate-600">
              Gib deinen Einladungscode ein und steige in die laufende Party ein.
            </span>
          </span>
        </a>
      </div>
    </div>

    <div class="relative hidden lg:block">
      <div class="absolute -inset-4 rounded-[2rem] bg-cyan-100/50 blur-2xl"></div>
      <img
        src="/images/party-hero.png"
        alt="Heller Spieltisch mit Karten und Spielfiguren"
        class="relative aspect-[4/5] max-h-[34rem] w-full rounded-2xl border border-white object-cover object-[center_45%] shadow-xl shadow-slate-200/80"
      />
    </div>
  </section>
</main>

