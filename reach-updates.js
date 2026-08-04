(function () {
  var data = window.NSL_IMPORTED_DATA;
  if (!data) return;

  var placementUpdates = [
    { sourceKey: "ig:povprits", sortDate: "2026-02-10", guaranteed: 2000 }
  ];
  var reelUpdates = [
    { sourceKey: "vk:darianutridocmed", sortDate: "2026-03-26", guaranteed: 200, reelsReach: 273 },
    { sourceKey: "ig:dubrovina__tatyana13", sortDate: "2026-03-27", guaranteed: 5000, reelsReach: 5556 }
  ];

  placementUpdates.forEach(function (update) {
    var record = data.placements.find(function (item) {
      return item.sourceKey === update.sourceKey && item.sortDate === update.sortDate;
    });
    if (!record) return;
    if (update.guaranteed != null) record.guaranteed = update.guaranteed;
    if (update.actual != null) record.actual = update.actual;
  });

  reelUpdates.forEach(function (update) {
    var record = data.reels.find(function (item) {
      return item.sourceKey === update.sourceKey && item.sortDate === update.sortDate;
    });
    if (!record) return;
    if (update.guaranteed != null) record.guaranteed = update.guaranteed;
    if (update.reelsReach != null) record.reelsReach = update.reelsReach;
    if (update.carouselReach != null) record.carouselReach = update.carouselReach;
  });

  var affected = {};
  placementUpdates.concat(reelUpdates).forEach(function (item) { affected[item.sourceKey] = true; });
  Object.keys(affected).forEach(function (sourceKey) {
    var placementRows = data.placements.filter(function (item) { return item.sourceKey === sourceKey; });
    var reelRows = data.reels.filter(function (item) { return item.sourceKey === sourceKey; });
    var actualReach = placementRows.reduce(function (sum, item) { return sum + Number(item.actual || 0); }, 0) +
      reelRows.reduce(function (sum, item) { return sum + Number(item.reelsReach || 0) + Number(item.carouselReach || 0); }, 0);
    var tag = (placementRows[0] || reelRows[0] || {}).tag;
    var blogger = data.bloggers.find(function (item) { return tag && item.name === tag; });
    if (blogger) blogger.reach = Math.round(actualReach);
  });

  data.meta.snapshot = "15.07.2026";
  data.meta.reachUpdatedAt = "15.07.2026 15:24";
  data.meta.reachUpdates = placementUpdates.length + reelUpdates.length;
})();
