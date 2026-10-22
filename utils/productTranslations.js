'use strict';

const translations = require('./product-translations.ru.json');
const { normalizeText } = require('../js/search-engine');

function isRussian(value) {
  return String(value || '').toLowerCase() === 'ru';
}

function localizeProduct(product, language) {
  if (!product || !isRussian(language)) return product;
  const translation = translations[String(product.id || '')];
  if (!translation) return product;
  const originalName = product.name || '';
  const originalDescription = product.description || product.desc || '';
  return {
    ...product,
    nameUz: originalName,
    descriptionUz: originalDescription,
    name: translation.name || originalName,
    desc: translation.description || originalDescription,
    description: translation.description || originalDescription,
  };
}

function matchingProductIds(query) {
  const needle = normalizeText(query);
  if (!needle) return [];
  return Object.entries(translations)
    .filter(([, translation]) => normalizeText(`${translation.name || ''} ${translation.description || ''}`).includes(needle))
    .map(([id]) => id);
}

module.exports = { translations, isRussian, localizeProduct, matchingProductIds };
