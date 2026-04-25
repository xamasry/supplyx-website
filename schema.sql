-- Schema for SupplyBridge (PostgreSQL / Supabase)

CREATE TYPE user_role AS ENUM ('buyer', 'supplier', 'admin');
CREATE TYPE request_status AS ENUM ('open', 'bidding', 'accepted', 'in_delivery', 'completed', 'cancelled');
CREATE TYPE bid_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'fawry');
CREATE TYPE payment_status AS ENUM ('pending', 'escrow', 'released', 'refunded');
CREATE TYPE delivery_status AS ENUM ('pending', 'out_for_delivery', 'delivered', 'failed');
CREATE TYPE dispute_status AS ENUM ('none', 'open', 'investigating', 'resolved');
CREATE TYPE target_audience AS ENUM ('all', 'nearby');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  user_type user_role NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  business_address TEXT NOT NULL,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  governorate VARCHAR(100),
  city VARCHAR(100),
  profile_image_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  rating DECIMAL(2,1) DEFAULT 0.0,
  total_orders INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  parent_id UUID REFERENCES categories(id) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  description TEXT,
  unit VARCHAR(50) NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES users(id) NOT NULL,
  product_id UUID REFERENCES products(id) NULL,
  custom_product_name VARCHAR(255),
  category_id UUID REFERENCES categories(id) NOT NULL,
  quantity DECIMAL NOT NULL,
  unit VARCHAR(50) NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  delivery_address TEXT,
  status request_status DEFAULT 'open',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_bid_id UUID NULL, -- References bids(id), added in alter
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) NOT NULL,
  supplier_id UUID REFERENCES users(id) NOT NULL,
  price DECIMAL NOT NULL,
  price_per_unit DECIMAL NOT NULL,
  delivery_time_minutes INT NOT NULL,
  delivery_notes TEXT,
  status bid_status DEFAULT 'pending',
  is_visible_to_all BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE requests ADD CONSTRAINT fk_accepted_bid FOREIGN KEY (accepted_bid_id) REFERENCES bids(id);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) NOT NULL,
  bid_id UUID REFERENCES bids(id) NOT NULL,
  buyer_id UUID REFERENCES users(id) NOT NULL,
  supplier_id UUID REFERENCES users(id) NOT NULL,
  total_amount DECIMAL NOT NULL,
  platform_commission DECIMAL NOT NULL,
  supplier_amount DECIMAL NOT NULL,
  payment_method payment_method NOT NULL,
  payment_status payment_status DEFAULT 'pending',
  payment_reference VARCHAR(255),
  delivery_status delivery_status DEFAULT 'pending',
  delivery_proof_image TEXT,
  buyer_confirmed BOOLEAN DEFAULT FALSE,
  dispute_status dispute_status DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE supplier_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES users(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  title_ar VARCHAR(255) NOT NULL,
  offer_price DECIMAL NOT NULL,
  original_price DECIMAL NOT NULL,
  discount_percentage DECIMAL,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  min_order_quantity DECIMAL DEFAULT 1,
  unit VARCHAR(50) NOT NULL,
  description_ar TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  target_audience target_audience DEFAULT 'all',
  radius_km INT DEFAULT 10,
  views_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
