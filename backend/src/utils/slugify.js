// Lowercase, hyphen-separated URL slug (e.g. "Men's Shoes" -> "men-s-shoes")
const slugify = (str) =>
  str.toLowerCase().trim().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/(^-|-$)/g, '');

module.exports = slugify;
