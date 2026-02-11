import { config } from '@/config';

interface EnergyPrice {
    readingDate: string;
    price: number;
}

class EnergyPriceService {
    private cachedPrices: Map<number, number> = new Map(); // Hour (0-23) -> Price
    private lastFetchDate: string | null = null;

    /**
     * Fetch prices for the current day if not already cached
     */
    async updatePrices() {
        const today = new Date().toISOString().split('T')[0];
        
        if (this.lastFetchDate === today && this.cachedPrices.size > 0) {
            return;
        }

        try {
            console.log(`fetching energy prices for ${today}...`);
            const fromDate = `${today}T00:00:00.000Z`;
            const tillDate = `${today}T23:59:59.999Z`;
            
            // EnergyZero API (UsageType 1 = Electricity)
            const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${fromDate}&tillDate=${tillDate}&interval=4&usageType=1`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Price API returned ${response.status}`);
            
            const data = await response.json();
            
            if (data.Prices && Array.isArray(data.Prices)) {
                this.cachedPrices.clear();
                data.Prices.forEach((p: EnergyPrice) => {
                    const hour = new Date(p.readingDate).getUTCHours();
                    
                    // EnergyZero returns raw spot price. 
                    // Calculate all-in price: (Spot + Markup) * (1 + VAT)
                    const spotPrice = p.price;
                    const allInPrice = (spotPrice + config.energy.markup) * (1 + config.energy.vat);
                    
                    this.cachedPrices.set(hour, allInPrice);
                });
                this.lastFetchDate = today;
                console.log(`✅ Cached ${this.cachedPrices.size} hourly prices (All-in price example: €${this.cachedPrices.get(12)?.toFixed(3)}/kWh).`);
            }
        } catch (error) {
            console.error('Failed to fetch energy prices:', error);
        }
    }

    /**
     * Get the price for a specific hour
     * @param date The date/time to check
     * @returns Price per kWh
     */
    async getPriceAt(date: Date): Promise<number> {
        await this.updatePrices();
        
        const hour = date.getUTCHours();
        const basePrice = this.cachedPrices.get(hour);
        
        if (basePrice === undefined) {
            // Fallback to a default if API fails or hour missing
            return 0.30; 
        }

        return basePrice;
    }

    /**
     * Get current price
     */
    async getCurrentPrice(): Promise<number> {
        return this.getPriceAt(new Date());
    }
}

export const energyPriceService = new EnergyPriceService();
