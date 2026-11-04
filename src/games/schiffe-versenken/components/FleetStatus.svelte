<script>
  /** @typedef {import('../types').SchiffeFleetEntry} FleetEntry */
  /** @typedef {import('../types').SchiffeShip} Ship */

  /** @type {FleetEntry[]} */
  export let fleet = [];
  /** Ships visible to the viewer (own: all, opponent: only sunk). @type {Ship[]} */
  export let ships = [];
  /** Own fleet shows hits per ship. */
  export let own = false;
  export let label = 'Flotte';

  /**
   * @param {FleetEntry[]} fleetList
   * @param {Ship[]} shipList
   */
  function rows(fleetList, shipList) {
    return fleetList.map((entry) => {
      const ship = shipList.find((candidate) => candidate.id === entry.id);
      return {
        id: entry.id,
        name: entry.name,
        length: entry.length,
        sunk: Boolean(ship?.sunk),
        hits: ship ? Math.min(ship.hits ?? 0, entry.length) : 0
      };
    });
  }

  $: list = rows(fleet, ships);
  $: afloat = list.filter((row) => !row.sunk).length;
</script>

<div class="fs">
  <p class="fs-head">
    <span class="fs-title">{label}</span>
    <span class="fs-count">{afloat} von {list.length} schwimmen</span>
  </p>
  <ul class="fs-list">
    {#each list as row (row.id)}
      <li class="fs-item" class:is-sunk={row.sunk}>
        <span class="fs-pips" aria-hidden="true">
          {#each Array(row.length) as _, index (index)}
            <span class="fs-pip" class:is-hit={row.sunk || (own && index < row.hits)}></span>
          {/each}
        </span>
        <span class="fs-name">{row.name}</span>
        <span class="sr-only">
          {row.sunk ? 'versenkt' : own && row.hits > 0 ? `${row.hits} Treffer` : 'schwimmt'}
        </span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .fs {
    display: grid;
    gap: 0.4rem;
    min-width: 0;
  }

  .fs-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.8125rem;
  }

  .fs-title {
    font-weight: 600;
    color: var(--text, #1f201d);
  }

  .fs-count {
    color: var(--muted, #62625f);
    font-variant-numeric: tabular-nums;
  }

  .fs-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .fs-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    font-size: 0.8125rem;
    color: var(--text, #1f201d);
  }

  .fs-pips {
    display: inline-flex;
    gap: 2px;
  }

  .fs-pip {
    position: relative;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 2px;
    background: var(--sv-hull, #4a6273);
  }

  .fs-pip.is-hit {
    background: var(--sv-hit, #d9472f);
  }

  .is-sunk .fs-pip {
    background: var(--sv-hull-sunk, #1d2a35);
  }

  /* Sunk ships get a strike line over pips and name, not only a colour change. */

  .is-sunk .fs-pip::after {
    content: '';
    position: absolute;
    left: -1px;
    right: -2px;
    top: 50%;
    height: 2px;
    margin-top: -1px;
    background: var(--sv-hit, #d9472f);
  }

  .is-sunk .fs-name {
    color: var(--muted, #62625f);
    text-decoration: line-through;
    text-decoration-thickness: 2px;
    text-decoration-color: var(--sv-hit, #d9472f);
  }
</style>
