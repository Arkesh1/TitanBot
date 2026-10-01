import {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { GifFrame, GifUtil } from 'gifwrap';
import EconomyService from '../../services/economyService.js';

const SPIN_COST = 50;

const MULTIPLIERS = [
  { multiplier: 0, payout: 0 },
  { multiplier: 1, payout: 50 },
  { multiplier: 2, payout: 100 },
  { multiplier: 3, payout: 150 }
];

const WHEEL_SIZE = 512;
const FRAME_COUNT = 40;
const FRAME_DELAY = 8; // 80ms
const FULL_SPINS = 5;

const wheelPath = path.join(
  process.cwd(),
  'src',
  'spin-wheel.png'
);

const arrowPath = path.join(
  process.cwd(),
  'src',
  'spin-arrow.png'
);

async function createSpinGif(resultMultiplier) {
  const wheelBuffer = await fs.readFile(wheelPath);

  const wheel = await sharp(wheelBuffer)
    .ensureAlpha()
    .resize(WHEEL_SIZE, WHEEL_SIZE, {
      fit: 'contain'
    })
    .png()
    .toBuffer();

  const arrow = await sharp(await fs.readFile(arrowPath))
    .ensureAlpha()
    .resize({
      width: 115
    })
    .png()
    .toBuffer();

  /*
   * Original wheel positions:
   *
   *       3x
   *   0x      2x
   *       1x
   *
   * Positive Sharp rotation is clockwise.
   * Therefore these rotations put each result under
   * the fixed arrow at the top.
   */
  const targetRotation = {
    3: 0,
    2: 270,
    1: 180,
    0: 90
  }[resultMultiplier];

  const finalRotation =
    targetRotation +
    FULL_SPINS * 360;

  const frames = [];

  for (let i = 0; i < FRAME_COUNT; i++) {
    const progress = i / (FRAME_COUNT - 1);

    // Ease-out: fast at first, gradually slows down.
    const eased =
      1 - Math.pow(1 - progress, 3);

    const rotation =
      finalRotation * eased;

    const rotatedWheel = await sharp(wheel)
      .rotate(rotation, {
        background: {
          r: 0,
          g: 0,
          b: 0,
          alpha: 0
        }
      })
      .png()
      .toBuffer();

    const metadata = await sharp(rotatedWheel).metadata();

    const left =
      Math.round((metadata.width - WHEEL_SIZE) / 2);

    const top =
      Math.round((metadata.height - WHEEL_SIZE) / 2);

    const croppedWheel = await sharp(rotatedWheel)
      .extract({
        left: Math.max(0, left),
        top: Math.max(0, top),
        width: Math.min(WHEEL_SIZE, metadata.width),
        height: Math.min(WHEEL_SIZE, metadata.height)
      })
      .extend({
        top: 0,
        bottom: Math.max(0, WHEEL_SIZE - Math.min(WHEEL_SIZE, metadata.height)),
        left: 0,
        right: Math.max(0, WHEEL_SIZE - Math.min(WHEEL_SIZE, metadata.width)),
        background: {
          r: 0,
          g: 0,
          b: 0,
          alpha: 0
        }
      })
      .png()
      .toBuffer();

    const finalFrame = await sharp(croppedWheel)
      .composite([
        {
          input: arrow,
          gravity: 'north'
        }
      ])
      .ensureAlpha()
      .raw()
      .toBuffer({
        resolveWithObject: true
      });

    const frame = new GifFrame(
      finalFrame.info.width,
      finalFrame.info.height,
      {
        delayCentisecs: FRAME_DELAY
      }
    );

    finalFrame.data.copy(frame.bitmap.data);

    frames.push(frame);
  }

  // Hold the winning position briefly.
  const finalFrame = frames[frames.length - 1];

  for (let i = 0; i < 8; i++) {
    frames.push(new GifFrame(finalFrame));
  }

  // GIF supports a maximum of 256 color indexes.
  // Quantize all frames together so they share a consistent palette.
  GifUtil.quantizeWu(
    frames,
    256,
    5,
    {
      ditherAlgorithm: 'FloydSteinberg',
      serpentine: true
    }
  );

  const gif = await GifUtil.write(
    '/tmp/spin-result.gif',
    frames,
    {
      loops: 1
    }
  );
  return gif.buffer;
}

export default {
  data: new SlashCommandBuilder()
    .setName('spin')
    .setDescription('Spin the Emerald wheel for 50 Emeralds'),

  category: 'economy',

async execute(interaction) {
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  const currentEmeralds =
    await EconomyService.getEmeralds(
      interaction.client,
      guildId,
      userId
    );

  if (currentEmeralds < SPIN_COST) {
    return interaction.reply({
      content:
        `💎 You need **${SPIN_COST} Emeralds** to spin. You have **${currentEmeralds}**.`,
      ephemeral: true
    });
  }

  const confirmButton = new ButtonBuilder()
    .setCustomId(`spin_confirm_${userId}`)
    .setLabel('Confirm Spin')
    .setEmoji('🎡')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId(`spin_cancel_${userId}`)
    .setLabel('Cancel')
    .setEmoji('❌')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder()
    .addComponents(
      confirmButton,
      cancelButton
    );

  const response = await interaction.reply({
    content:
      `⚠️ **Spin the Emerald Wheel?**\n\n` +
      `This will cost **50 Emeralds**.\n` +
      `Possible winnings: **0, 50, 100, or 150 Emeralds**.\n\n` +
      `You currently have **${currentEmeralds} Emeralds**.\n\n` +
      `Click **Confirm Spin** to continue.`,
    components: [row],
    ephemeral: true,
    fetchReply: true
  });

  try {
    const confirmation =
      await response.awaitMessageComponent({
        filter: i =>
          i.user.id === userId,
        time: 30000
      });

    if (
      confirmation.customId ===
      `spin_cancel_${userId}`
    ) {
      return confirmation.update({
        content: '❌ Spin cancelled.',
        components: []
      });
    }

    if (
      confirmation.customId !==
      `spin_confirm_${userId}`
    ) {
      return;
    }

    await confirmation.update({
      content: '🎡 **Spinning the wheel...**',
      components: []
    });

    /*
     * Check balance again immediately before charging.
     */
    const latestEmeralds =
      await EconomyService.getEmeralds(
        interaction.client,
        guildId,
        userId
      );

    if (latestEmeralds < SPIN_COST) {
      return interaction.editReply({
        content:
          `❌ You no longer have enough Emeralds.\n\n` +
          `You need **50 Emeralds**, but you only have **${latestEmeralds}**.`,
        components: []
      });
    }

    /*
     * Decide the result before the animation.
     */
    const result =
      MULTIPLIERS[
        Math.floor(
          Math.random() *
          MULTIPLIERS.length
        )
      ];

    /*
     * Charge the spin.
     */
    await EconomyService.removeEmeralds(
      interaction.client,
      guildId,
      userId,
      SPIN_COST,
      'spin-cost'
    );

    try {
      const gifBuffer =
        await createSpinGif(
          result.multiplier
        );

      /*
       * Award winnings.
       */
      if (result.payout > 0) {
        await EconomyService.addEmeralds(
          interaction.client,
          guildId,
          userId,
          result.payout,
          `spin-${result.multiplier}x`
        );
      }

      const attachment =
        new AttachmentBuilder(
          gifBuffer,
          {
            name: 'spin.gif'
          }
        );

      const net =
        result.payout - SPIN_COST;

      let resultText;

      if (result.multiplier === 0) {
        resultText =
          `**0× — You won nothing!**`;
      } else {
        resultText =
          `**${result.multiplier}× — You won ${result.payout} Emeralds!**`;
      }

      await interaction.editReply({
        content:
          `🎡 **${interaction.user} spun the wheel!**\n\n` +
          `${resultText}\n` +
          `Entry cost: **50 Emeralds**\n` +
          `Net: **${net >= 0 ? '+' : ''}${net} Emeralds**`,
        files: [attachment],
        components: []
      });

    } catch (error) {
      console.error(
        'Spin animation error:',
        error
      );

      /*
       * Refund if animation fails.
       */
      await EconomyService.addEmeralds(
        interaction.client,
        guildId,
        userId,
        SPIN_COST,
        'spin-refund'
      );

      await interaction.editReply({
        content:
          '❌ Something went wrong while spinning the wheel. Your **50 Emeralds have been refunded**.',
        components: []
      });
    }

  } catch (error) {
    /*
     * Confirmation timed out.
     */
    if (error?.code === 'InteractionCollectorError') {
      return interaction.editReply({
        content:
          '⌛ Spin confirmation timed out. No Emeralds were charged.',
        components: []
      });
    }

    console.error(
      'Spin confirmation error:',
      error
    );
  }
}
};
