import Handlebars from 'handlebars';

export function registerHelpers() {
  Handlebars.registerHelper({
    formatNumber(number) {
      if (number == null) return '';
      if (Math.abs(number) < 1000) {
        return Number.isInteger(number) ? number : number.toFixed(3);
      }
      return number.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    },
    
    formatChange(value) {
      if (value == null) return '';
      const formattedValue = Handlebars.helpers.formatNumber(Math.abs(value));
      return value > 0 ? `+${formattedValue}` : `-${formattedValue}`;
    },
    
    formatChangePercent(value) {
      if (value == null) return '';
      const formattedValue = Math.abs(value);
      return value > 0 ? `+${formattedValue}%` : `${formattedValue}%`;
    },
    
    getChangeClass(change) {
      if (change == null) return 'neutral';
      return change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
    },
    
    formatImportance(importance) {
      const stars = Number(importance) || 1;
      let result = '';
      for (let i = 0; i < 3; i++) {
        result += `<span class="${i < stars ? 'star-filled' : 'star-empty'}">★</span>`;
      }
      return new Handlebars.SafeString(result);
    },
    
    getValueClass(value, previous) {
      if (!value || !previous) return '';
      const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
      const numPrevious = parseFloat(previous.replace(/[^0-9.-]/g, ''));
      return numValue > numPrevious ? 'positive' : numValue < numPrevious ? 'negative' : 'neutral';
    },
  });
}

export function registerMappingHelpers(mappings) {
  Object.entries(mappings).forEach(([helperName, map]) => {
    Handlebars.registerHelper(helperName, (name) => map[name] || name);
  });
}

Handlebars.registerHelper('formatLargeNumber', function(value) {
    if (typeof value !== 'number') return '0';
    
    if (value >= 1e12) {
        return (value / 1e12).toFixed(2) + 'T';
    } else if (value >= 1e9) {
        return (value / 1e9).toFixed(2) + 'B';
    } else if (value >= 1e6) {
        return (value / 1e6).toFixed(2) + 'M';
    }
    return value.toLocaleString();
}); 