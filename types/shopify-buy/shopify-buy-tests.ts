/// <reference types="jquery" />

/* Build new ShopifyBuy client
============================================================ */
let client = ShopifyBuy.buildClient({
    apiKey: 'bf081e860bc9dc1ce0654fdfbc20892d',
    domain: 'embeds',
    appId: '6'
});

var product : ShopifyBuy.Shopify.ProductModel;
var cart : ShopifyBuy.Shopify.CartModel;
var cartLineItemCount : number;
if(localStorage.getItem('lastCartId')) {
    client.fetchCart(localStorage.getItem('lastCartId')).then(function(remoteCart : ShopifyBuy.Shopify.CartModel) {
        cart = remoteCart;
        cartLineItemCount = cart.lineItems.length;
        renderCartItems();
    });
} else {
    client.createCart().then(function (newCart : ShopifyBuy.Shopify.CartModel) {
        cart = newCart;
        localStorage.setItem('lastCartId', ""+cart.id);
        cartLineItemCount = 0;
    });
}

var previousFocusItem : any;

/* Fetch product and init
============================================================ */
client.fetchProduct('3614436099').then(function (fetchedProduct : ShopifyBuy.Shopify.ProductModel) {
    product = fetchedProduct;
    var selectedVariant : ShopifyBuy.Shopify.ProductVariantModel = product.selectedVariant;
    var selectedVariantImage : any = product.selectedVariantImage;
    var currentOptions : ShopifyBuy.Shopify.ProductOptionModel[] = product.options;

    var variantSelectors = generateSelectors(product);
    $('.variant-selectors').html(""+variantSelectors);

    updateProductTitle(product.title);
    updateVariantImage(selectedVariantImage);
    updateVariantTitle(selectedVariant);
    updateVariantPrice(selectedVariant);
    attachOnVariantSelectListeners(product);
    updateCartTabButton();
    bindEventListeners();
});

/* Generate DOM elements for variant selectors
============================================================ */
function generateSelectors(product : ShopifyBuy.Shopify.ProductModel) {
    var elements = product.options.map(function(option : ShopifyBuy.Shopify.ProductOptionModel) {
        var optionsHtml = option.values.map(function(value : any) {
            return '<option value="' + value + '">' + value + '</option>';
        });

        return '<div class="shopify-select">\
                <select class="select" name="' + option.name + '">' + optionsHtml + '</select>\
                <svg class="shopify-select-icon" viewBox="0 0 24 24"><path d="M21 5.176l-9.086 9.353L3 5.176.686 7.647 12 19.382 23.314 7.647 21 5.176z"></path></svg>\
                </div>'
    });
    return elements;
}

/* Bind Event Listeners
============================================================ */
function bindEventListeners() {
    /* cart close button listener */
    $('.cart .btn--close').on('click', closeCart);

    /* click away listener to close cart */
    $(document).on('click', function(evt) {
        if((!$(evt.target).closest('.cart').length) && (!$(evt.target).closest('.js-prevent-cart-listener').length)) {
        closeCart();
        }
    });

    /* escape key handler */
    var ESCAPE_KEYCODE = 27;
    $(document).on('keydown', function (evt) {
        if (evt.which === ESCAPE_KEYCODE) {
        if (previousFocusItem) {
            $(previousFocusItem).focus();
            previousFocusItem = ''
        }
        closeCart();
        }
    });

    /* checkout button click listener */
    $('.btn--cart-checkout').on('click', function () {
        window.open(cart.checkoutUrl, '_self');
    });

    /* buy button click listener */
    $('.buy-button').on('click', buyButtonClickHandler);

    /* increment quantity click listener */
    $('.cart').on('click', '.quantity-increment', function () {
        var variantId = $(this).data('variant-id');
        incrementQuantity(variantId);
    });

    /* decrement quantity click listener */
    $('.cart').on('click', '.quantity-decrement', function() {
        var variantId = $(this).data('variant-id');
        decrementQuantity(variantId);
    });

    /* update quantity field listener */
    $('.cart').on('keyup', '.cart-item__quantity', debounce(fieldQuantityHandler, 250));

    /* cart tab click listener */
    $('.btn--cart-tab').click(() => {
        setPreviousFocusItem(this);
        openCart();
    });
}


/* Variant option change handler
============================================================ */
function attachOnVariantSelectListeners(product : ShopifyBuy.Shopify.ProductModel) {
    $('.variant-selectors').on('change', 'select', function(event) {
        var $element : any = $(event.target);
        var name : string = $element.attr('name');
        var value : string = $element.val();
        product.options.filter(function(option : ShopifyBuy.Shopify.ProductOptionModel) {
            return option.name === name;
        })[0].selected = value;

        var selectedVariant : ShopifyBuy.Shopify.ProductVariantModel = product.selectedVariant;
        var selectedVariantImage : any = product.selectedVariantImage;
        updateProductTitle(product.title);
        updateVariantImage(selectedVariantImage);
        updateVariantTitle(selectedVariant);
        updateVariantPrice(selectedVariant);
    });
}

/* Update product title
============================================================ */
function updateProductTitle(title : string) {
    $('#buy-button-1 .product-title').text(title);
}

/* Update product image based on selected variant
============================================================ */
function updateVariantImage(image : any) {
    var src = (image) ? image.src : ShopifyBuy.NO_IMAGE_URI;

    $('#buy-button-1 .variant-image').attr('src', src);
}

/* Update product variant title based on selected variant
============================================================ */
function updateVariantTitle(variant : ShopifyBuy.Shopify.ProductVariantModel) {
    $('#buy-button-1 .variant-title').text(variant.title);
}

/* Update product variant price based on selected variant
============================================================ */
function updateVariantPrice(variant : ShopifyBuy.Shopify.ProductVariantModel) {
    $('#buy-button-1 .variant-price').text('$' + variant.price);
}

/* Attach and control listeners onto buy button
============================================================ */
function buyButtonClickHandler(evt : any) {
    evt.preventDefault();
    var id : string | number = product.selectedVariant.id;
    var quantity : number;
    var cartLineItem : ShopifyBuy.Shopify.CartLineItemModel = findCartItemByVariantId(id);

    quantity = cartLineItem ? cartLineItem.quantity + 1 : 1;

    addOrUpdateVariant(product.selectedVariant, quantity);
    setPreviousFocusItem(evt.target);
    $('#checkout').focus();
}

/* Update product variant quantity in cart
============================================================ */
function updateQuantity(fn : Function, variantId : string | number) {
    var variant : ShopifyBuy.Shopify.ProductVariantModel = product.variants.filter(function (variant : ShopifyBuy.Shopify.ProductVariantModel) {
        return (variant.id === variantId);
    })[0];
    var quantity : number;
    var cartLineItem : ShopifyBuy.Shopify.CartLineItemModel = findCartItemByVariantId(variant.id);
    if (cartLineItem) {
        quantity = fn(cartLineItem.quantity);
        updateVariantInCart(cartLineItem, quantity);
    }
}

/* Decrease quantity amount by 1
============================================================ */
function decrementQuantity(variantId : string | number) {
    updateQuantity(function(quantity : number) {
        return quantity - 1;
    }, variantId);
}

/* Increase quantity amount by 1
============================================================ */
function incrementQuantity(variantId : string | number) {
    updateQuantity(function(quantity : number) {
        return quantity + 1;
    }, variantId);
}

/* Update product variant quantity in cart through input field
============================================================ */
function fieldQuantityHandler(evt : any) {
    var variantId : string | number = parseInt($(this).closest('.cart-item').attr('data-variant-id'), 10);
    var variant : ShopifyBuy.Shopify.ProductVariantModel = product.variants.filter(function (variant : ShopifyBuy.Shopify.ProductVariantModel) {
        return (variant.id === variantId);
    })[0];
    var cartLineItem : ShopifyBuy.Shopify.CartLineItemModel = findCartItemByVariantId(variant.id);
    var quantity : number = evt.target.value;
    if (cartLineItem) {
        updateVariantInCart(cartLineItem, quantity);
    }
}

/* Debounce taken from _.js
============================================================ */
function debounce(func : any, wait : number, immediate? : number) {
    var timeout : number;
    return function() {
        var context = this, args = arguments;
        var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    }
}

/* Open Cart
============================================================ */
function openCart() {
    $('.cart').addClass('js-active');
}

/* Close Cart
============================================================ */
function closeCart() {
    $('.cart').removeClass('js-active');
    $('.overlay').removeClass('js-active');
}

/* Find Cart Line Item By Variant Id
============================================================ */
function findCartItemByVariantId(variantId : string | number) {
    return cart.lineItems.filter(function (item) {
        return (item.variant_id === variantId);
    })[0];
}

/* Determine action for variant adding/updating/removing
============================================================ */
function addOrUpdateVariant(variant : ShopifyBuy.Shopify.ProductVariantModel, quantity : number) {
    openCart();
    var cartLineItem : ShopifyBuy.Shopify.CartLineItemModel = findCartItemByVariantId(variant.id);

    if (cartLineItem) {
        updateVariantInCart(cartLineItem, quantity);
    } else {
        addVariantToCart(variant, quantity);
    }

    updateCartTabButton();
}

/* Update details for item already in cart. Remove if necessary
============================================================ */
function updateVariantInCart(cartLineItem : ShopifyBuy.Shopify.CartLineItemModel, quantity : number) {
    var variantId : string | number = cartLineItem.variant_id;
    var cartLength : number = cart.lineItems.length;
    cart.updateLineItem(cartLineItem.id, quantity).then(function(updatedCart : ShopifyBuy.Shopify.CartModel) {
        var $cartItem = $('.cart').find('.cart-item[data-variant-id="' + variantId + '"]');
        if (updatedCart.lineItems.length >= cartLength) {
            $cartItem.find('.cart-item__quantity').val(cartLineItem.quantity);
            $cartItem.find('.cart-item__price').text(formatAsMoney(cartLineItem.line_price));
        } else {
            $cartItem.addClass('js-hidden').bind('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function() {
                $cartItem.remove();
            });
        }

        updateCartTabButton();
        updateTotalCartPricing();
        if (updatedCart.lineItems.length < 1) {
            closeCart();
        }
    }).catch(function (errors : string) {
        console.log('Fail');
        console.error(errors);
    });
}

/* Add 'quantity' amount of product 'variant' to cart
============================================================ */
function addVariantToCart(variant : ShopifyBuy.Shopify.ProductVariantModel, quantity : number) {
    openCart();

    cart.addVariants({ variant: variant, quantity: quantity }).then(function() {
        var cartItem : ShopifyBuy.Shopify.CartLineItemModel = cart.lineItems.filter(function (item : ShopifyBuy.Shopify.CartLineItemModel ) {
            return (item.variant_id === variant.id);
        })[0];
        var $cartItem = renderCartItem(cartItem);
        var $cartItemContainer = $('.cart-item-container');
        $cartItemContainer.append($cartItem);
        setTimeout(function () {
            $cartItemContainer.find('.js-hidden').removeClass('js-hidden');
        }, 0)

    }).catch(function (errors : string) {
        console.log('Fail');
        console.error(errors);
    });

    updateTotalCartPricing();
    updateCartTabButton();
}

/* Return required markup for single item rendering
============================================================ */
function renderCartItem(lineItem : ShopifyBuy.Shopify.CartLineItemModel) {
    var lineItemEmptyTemplate = $('#CartItemTemplate').html();
    var $lineItemTemplate = $(lineItemEmptyTemplate);
    var itemImage = lineItem.image.src;
    $lineItemTemplate.attr('data-variant-id', lineItem.variant_id);
    $lineItemTemplate.addClass('js-hidden');
    $lineItemTemplate.find('.cart-item__img').css('background-image', 'url(' + itemImage + ')');
    $lineItemTemplate.find('.cart-item__title').text(lineItem.title);
    $lineItemTemplate.find('.cart-item__variant-title').text(lineItem.variant_title);
    $lineItemTemplate.find('.cart-item__price').text(formatAsMoney(lineItem.line_price));
    $lineItemTemplate.find('.cart-item__quantity').attr('value', lineItem.quantity);
    $lineItemTemplate.find('.quantity-decrement').attr('data-variant-id', lineItem.variant_id);
    $lineItemTemplate.find('.quantity-increment').attr('data-variant-id', lineItem.variant_id);

    return $lineItemTemplate;
}

/* Render the line items currently in the cart
============================================================ */
function renderCartItems() {
    var $cartItemContainer = $('.cart-item-container');
    $cartItemContainer.empty();
    var lineItemEmptyTemplate = $('#CartItemTemplate').html();
    var $cartLineItems = cart.lineItems.map(function (lineItem, index) {
        return renderCartItem(lineItem);
    });
    $cartItemContainer.append(...$cartLineItems);

    setTimeout(function () {
        $cartItemContainer.find('.js-hidden').removeClass('js-hidden');
    }, 0)
    updateTotalCartPricing();
}

/* Update Total Cart Pricing
============================================================ */
function updateTotalCartPricing() {
    $('.cart .pricing').text(formatAsMoney(cart.subtotal));
}

/* Format amount as currency
============================================================ */
function formatAsMoney(amount : string, currency? : string, thousandSeparator? : string, decimalSeparator? : string , localeDecimalSeparator? : string) {
    currency = currency || '$';
    thousandSeparator = thousandSeparator || ',';
    decimalSeparator = decimalSeparator || '.';
    localeDecimalSeparator = localeDecimalSeparator || '.';
    var regex = new RegExp('(\\d)(?=(\\d{3})+\\.)', 'g');

    return currency + parseFloat(amount).toFixed(2)
        .replace(localeDecimalSeparator, decimalSeparator)
        .replace(regex, '$1' + thousandSeparator)
        .toString();
}

/* Update cart tab button
============================================================ */
function updateCartTabButton() {
    if (cart.lineItems.length > 0) {
        $('.btn--cart-tab .btn__counter').html(""+cart.lineItemCount);
        $('.btn--cart-tab').addClass('js-active');
    } else {
        $('.btn--cart-tab').removeClass('js-active');
        $('.cart').removeClass('js-active');
    }
}

/* Set previously focused item for escape handler
============================================================ */
function setPreviousFocusItem(item : ShopifyBuy.Shopify.CartLineItemModel) {
    previousFocusItem = item;
}
